/**
 * Farmer Crop Projects Service
 * 
 * Core isolation system: Each crop = independent project workspace
 * Like Claude Projects / OpenAI Projects but for farming
 * 
 * Features:
 * - Isolated context, chat history, agents per crop
 * - Crop-specific AI knowledge and recommendations
 * - Independent telemetry, analytics per project
 * - Cross-project insights and comparisons
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import TelemetryService from './TelemetryService';

class FarmerCropProjectsService {
  static PROJECT_VERSION = '1.0';
  static STORAGE_PREFIX = 'crop_project_';
  static META_PREFIX = 'farmer_meta_';

  /**
   * Create new crop project (isolated workspace)
   */
  static async createCropProject(farmerId, projectData) {
    try {
      const projectId = this.generateProjectId(farmerId, projectData.cropName);
      
      const project = {
        // Core identity
        id: projectId,
        farmerId,
        cropName: projectData.cropName,
        displayName: projectData.displayName || projectData.cropName,
        
        // Project metadata
        version: this.PROJECT_VERSION,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        status: 'active', // active, completed, archived
        
        // Crop-specific data (isolated from other crops)
        cropDetails: {
          variety: projectData.variety || '',
          area: projectData.area || 0,
          plantingDate: projectData.plantingDate || '',
          expectedHarvest: projectData.expectedHarvest || '',
          season: projectData.season || this.getCurrentSeason(),
          growthStage: projectData.growthStage || 'planning',
          notes: projectData.notes || ''
        },
        
        // Isolated AI context
        aiContext: {
          conversationHistory: [],
          knowledgeBase: [],
          preferences: {},
          specializations: [projectData.cropName], // AI specialized for this crop
          lastInteraction: null
        },
        
        // Project-specific analytics
        analytics: {
          chatCount: 0,
          adviceRequests: 0,
          toolsUsed: [],
          commonQueries: [],
          satisfactionRating: 0,
          issuesResolved: 0
        },
        
        // Workflow state
        workflows: {
          alerts: [],
          reminders: [],
          recommendations: [],
          taskProgress: {}
        },
        
        // Sharing and collaboration
        sharing: {
          isShared: false,
          sharedWith: [],
          permissions: 'private'
        }
      };
      
      await this.saveProject(project);
      await TelemetryService.emit('crop.project.created', { 
        projectId, 
        farmerId, 
        cropName: projectData.cropName,
        area: projectData.area 
      });
      
      return project;
    } catch (error) {
      console.error('Failed to create crop project:', error);
      throw error;
    }
  }

  /**
   * Get all projects for a farmer
   */
  static async getFarmerProjects(farmerId) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const projectKeys = keys.filter(key => 
        key.startsWith(this.STORAGE_PREFIX) && key.includes(`_${farmerId}_`)
      );
      
      const projects = [];
      for (const key of projectKeys) {
        const projectData = await AsyncStorage.getItem(key);
        if (projectData) {
          projects.push(JSON.parse(projectData));
        }
      }
      
      // Sort by last accessed
      return projects.sort((a, b) => 
        new Date(b.lastAccessed) - new Date(a.lastAccessed)
      );
    } catch (error) {
      console.error('Failed to get farmer projects:', error);
      return [];
    }
  }

  /**
   * Get specific crop project
   */
  static async getCropProject(farmerId, cropName) {
    try {
      const projectId = this.generateProjectId(farmerId, cropName);
      const key = `${this.STORAGE_PREFIX}${projectId}`;
      const projectData = await AsyncStorage.getItem(key);
      
      if (projectData) {
        const project = JSON.parse(projectData);
        // Update last accessed
        project.lastAccessed = new Date().toISOString();
        await this.saveProject(project);
        return project;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get crop project:', error);
      return null;
    }
  }

  /**
   * Update project data
   */
  static async updateProject(projectId, updates) {
    try {
      const key = `${this.STORAGE_PREFIX}${projectId}`;
      const projectData = await AsyncStorage.getItem(key);
      
      if (projectData) {
        const project = JSON.parse(projectData);
        const updated = {
          ...project,
          ...updates,
          lastAccessed: new Date().toISOString(),
          version: this.PROJECT_VERSION
        };
        
        await this.saveProject(updated);
        await TelemetryService.emit('crop.project.updated', { 
          projectId, 
          updateKeys: Object.keys(updates) 
        });
        
        return updated;
      }
      
      throw new Error('Project not found');
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  /**
   * Add conversation to isolated project history
   */
  static async addConversation(projectId, query, response, metadata = {}) {
    try {
      const key = `${this.STORAGE_PREFIX}${projectId}`;
      const projectData = await AsyncStorage.getItem(key);
      
      if (projectData) {
        const project = JSON.parse(projectData);
        
        const conversation = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          query,
          response: response.advice || response.message || response,
          metadata: {
            processingType: response.processingType,
            model: response.model,
            toolsUsed: response.toolsUsed || [],
            safety: response.safety,
            hasTranslation: response.hasTranslation,
            ...metadata
          }
        };
        
        // Add to isolated history
        project.aiContext.conversationHistory.unshift(conversation);
        
        // Keep last 100 conversations per project
        project.aiContext.conversationHistory = 
          project.aiContext.conversationHistory.slice(0, 100);
        
        // Update analytics
        project.analytics.chatCount += 1;
        project.analytics.lastInteraction = conversation.timestamp;
        
        // Track tools used
        if (response.toolsUsed) {
          response.toolsUsed.forEach(tool => {
            if (!project.analytics.toolsUsed.includes(tool)) {
              project.analytics.toolsUsed.push(tool);
            }
          });
        }
        
        project.lastAccessed = new Date().toISOString();
        await this.saveProject(project);
        
        await TelemetryService.emit('crop.project.conversation', { 
          projectId, 
          queryLength: query.length,
          responseType: response.processingType,
          toolsUsed: response.toolsUsed?.length || 0
        });
        
        return conversation;
      }
      
      throw new Error('Project not found');
    } catch (error) {
      console.error('Failed to add conversation:', error);
      throw error;
    }
  }

  /**
   * Get isolated AI context for crop project
   */
  static async getProjectAIContext(projectId) {
    try {
      const key = `${this.STORAGE_PREFIX}${projectId}`;
      const projectData = await AsyncStorage.getItem(key);
      
      if (projectData) {
        const project = JSON.parse(projectData);
        
        // Build crop-specific context
        return {
          projectId,
          cropName: project.cropName,
          cropDetails: project.cropDetails,
          conversationHistory: project.aiContext.conversationHistory.slice(0, 10).flatMap(conv => [
            { role: 'user', content: conv.query },
            { role: 'assistant', content: conv.response }
          ]), // Last 10 conversations converted to message format
          specializations: project.aiContext.specializations,
          preferences: project.aiContext.preferences,
          analytics: project.analytics,
          workflows: project.workflows,
          
          // System context for AI
          __systemProjectContext: this.buildProjectSystemContext(project)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get project AI context:', error);
      return null;
    }
  }

  /**
   * Archive or delete project
   */
  static async archiveProject(projectId, deleteCompletely = false) {
    try {
      if (deleteCompletely) {
        const key = `${this.STORAGE_PREFIX}${projectId}`;
        await AsyncStorage.removeItem(key);
        await TelemetryService.emit('crop.project.deleted', { projectId });
      } else {
        await this.updateProject(projectId, { 
          status: 'archived',
          archivedAt: new Date().toISOString()
        });
        await TelemetryService.emit('crop.project.archived', { projectId });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to archive project:', error);
      return false;
    }
  }

  /** Permanently delete a project (hard delete wrapper) */
  static async deleteProject(projectId) {
    return this.archiveProject(projectId, true);
  }

  /** Unarchive a previously archived project */
  static async unarchiveProject(projectId) {
    try {
      await this.updateProject(projectId, { status: 'active', archivedAt: null, reactivatedAt: new Date().toISOString() });
      await TelemetryService.emit('crop.project.unarchived', { projectId });
      return true;
    } catch (e) {
      console.error('Failed to unarchive project:', e);
      return false;
    }
  }

  /** Persist farmer's last selected active project for default context */
  static async setLastSelectedProject(farmerId, projectId) {
    if (!farmerId || !projectId) return;
    try {
      await AsyncStorage.setItem(`${this.META_PREFIX}${farmerId}_lastProject`, projectId);
    } catch (e) { console.warn('Persist last project failed', e); }
  }

  static async getLastSelectedProject(farmerId) {
    if (!farmerId) return null;
    try {
      return await AsyncStorage.getItem(`${this.META_PREFIX}${farmerId}_lastProject`);
    } catch (e) { return null; }
  }

  /** Add a task to a project (stored inside workflows.tasks) */
  static async addTask(projectId, task) {
    const key = `${this.STORAGE_PREFIX}${projectId}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) throw new Error('Project not found');
    const project = JSON.parse(data);
    const tasks = project.workflows?.tasks || [];
    const newTask = {
      id: task.id || Date.now().toString(),
      label: task.label,
      dueDate: task.dueDate || '',
      status: task.status || 'pending',
      createdAt: new Date().toISOString(),
      meta: task.meta || {}
    };
    tasks.unshift(newTask);
    project.workflows.tasks = tasks.slice(0, 200); // cap
    await this.saveProject(project);
    await TelemetryService.emit('crop.project.task.added', { projectId, taskId: newTask.id });
    return newTask;
  }

  static async updateTask(projectId, taskId, updates) {
    const key = `${this.STORAGE_PREFIX}${projectId}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) throw new Error('Project not found');
    const project = JSON.parse(data);
    const tasks = project.workflows?.tasks || [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Task not found');
    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    project.workflows.tasks = tasks;
    await this.saveProject(project);
    await TelemetryService.emit('crop.project.task.updated', { projectId, taskId });
    return tasks[idx];
  }

  static async listTasks(projectId) {
    const key = `${this.STORAGE_PREFIX}${projectId}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) return [];
    const project = JSON.parse(data);
    return project.workflows?.tasks || [];
  }

  static async completeTask(projectId, taskId) {
    return this.updateTask(projectId, taskId, { status: 'completed', completedAt: new Date().toISOString() });
  }

  /**
   * Get cross-project insights
   */
  static async getCrossProjectAnalytics(farmerId) {
    try {
      const projects = await this.getFarmerProjects(farmerId);
      
      const analytics = {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        totalArea: projects.reduce((sum, p) => sum + (p.cropDetails.area || 0), 0),
        mostActiveCrop: null,
        totalConversations: projects.reduce((sum, p) => sum + p.analytics.chatCount, 0),
        commonTools: [],
        seasonalDistribution: {},
        projectHealth: {}
      };
      
      // Find most active crop
      let maxChats = 0;
      projects.forEach(project => {
        if (project.analytics.chatCount > maxChats) {
          maxChats = project.analytics.chatCount;
          analytics.mostActiveCrop = project.cropName;
        }
      });
      
      // Aggregate common tools across projects
      const toolFrequency = {};
      projects.forEach(project => {
        project.analytics.toolsUsed.forEach(tool => {
          toolFrequency[tool] = (toolFrequency[tool] || 0) + 1;
        });
      });
      analytics.commonTools = Object.entries(toolFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tool]) => tool);
      
      // Seasonal distribution
      projects.forEach(project => {
        const season = project.cropDetails.season || 'unknown';
        analytics.seasonalDistribution[season] = 
          (analytics.seasonalDistribution[season] || 0) + 1;
      });
      
      return analytics;
    } catch (error) {
      console.error('Failed to get cross-project analytics:', error);
      return null;
    }
  }

  // Helper methods
  static generateProjectId(farmerId, cropName) {
    return `${farmerId}_${cropName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  static async saveProject(project) {
    const key = `${this.STORAGE_PREFIX}${project.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(project));
  }

  static getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 9) return 'Kharif';
    if (month >= 10 && month <= 3) return 'Rabi';
    return 'Zaid';
  }

  static buildProjectSystemContext(project) {
    const parts = [];
    
    parts.push(`Project: ${project.displayName} (${project.cropName})`);
    
    if (project.cropDetails.variety) {
      parts.push(`Variety: ${project.cropDetails.variety}`);
    }
    
    if (project.cropDetails.area) {
      parts.push(`Area: ${project.cropDetails.area} acres`);
    }
    
    if (project.cropDetails.growthStage) {
      parts.push(`Growth stage: ${project.cropDetails.growthStage}`);
    }
    
    parts.push(`Season: ${project.cropDetails.season}`);
    
    if (project.aiContext.conversationHistory.length > 0) {
      const recentTopics = project.aiContext.conversationHistory
        .slice(0, 3)
        .map(conv => conv.query.substring(0, 50))
        .join('; ');
      parts.push(`Recent queries: ${recentTopics}`);
    }
    
    return parts.join('. ') + '.';
  }
}

export default FarmerCropProjectsService;
