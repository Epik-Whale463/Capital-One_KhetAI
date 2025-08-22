import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, RefreshControl, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import CropProjectCard from '../components/CropProjectCard';
import { useTranslation } from '../localization/translations';
import FarmerCropProjectsService from '../services/FarmerCropProjectsService';
import NextActionService from '../services/NextActionService';

// FlatList based layout now; width handled inside card

const CropProjectsScreen = ({ user, navigation }) => {
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [stageTargetProject, setStageTargetProject] = useState(null);
  const [selectedStage, setSelectedStage] = useState('');
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [taskTargetProject, setTaskTargetProject] = useState(null);
  const [newTask, setNewTask] = useState({ label: '', dueDate: '' });
  const [newProject, setNewProject] = useState({
    cropName: '',
    displayName: '',
    variety: '',
    area: '',
    season: 'Kharif',
    notes: ''
  });
  const { t } = useTranslation(user?.language);

  useEffect(() => {
    loadProjects();
  }, [user?.id]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      if (user?.id) {
        const farmerProjects = await FarmerCropProjectsService.getFarmerProjects(user.id);
        const farmAnalytics = await FarmerCropProjectsService.getCrossProjectAnalytics(user.id);
        setProjects(farmerProjects);
        setAnalytics(farmAnalytics);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const createProject = async () => {
    if (!newProject.cropName.trim()) {
  Alert.alert(t('error'), t('cropNameRequired'));
      return;
    }

    try {
      const projectData = {
        ...newProject,
        area: parseFloat(newProject.area) || 0,
        displayName: newProject.displayName || newProject.cropName
      };

      await FarmerCropProjectsService.createCropProject(user.id, projectData);
      setShowCreateModal(false);
      setNewProject({
        cropName: '',
        displayName: '',
        variety: '',
        area: '',
        season: 'Kharif',
        notes: ''
      });
      await loadProjects();
  Alert.alert(t('success'), t('cropCreated'));
    } catch (error) {
      console.error('Failed to create project:', error);
      Alert.alert(t('error'), t('cropCreateFailed'));
    }
  };

  const openProject = (project) => {
  FarmerCropProjectsService.setLastSelectedProject(user.id, project.id);
    navigation.navigate('ChatScreen', {
      activeProjectId: project.id,
      projectName: project.displayName,
      cropName: project.cropName
    });
  };

  const getCropEmoji = (cropName) => {
    const emojiMap = {
      'rice': '🌾',
      'wheat': '🌾',
      'cotton': '🌿',
      'sugarcane': '🎋',
      'corn': '🌽',
      'tomato': '🍅',
      'potato': '🥔',
      'onion': '🧅',
      'soybean': '🫘',
      'groundnut': '🥜'
    };
    return emojiMap[cropName.toLowerCase()] || '🌱';
  };

  const getStatusColor = (project) => {
    switch (project.status) {
      case 'active': return '#4caf50';
      case 'completed': return '#2196f3';
      case 'archived': return '#757575';
      default: return '#ff9800';
    }
  };

  const formatLastAccessed = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Wrapper using centralized service
  const deriveNextTask = (project) => NextActionService.deriveNextTask(project);

  const toggleExpand = (projectId) => setExpandedCardId(prev => prev === projectId ? null : projectId);


  const openStageWizard = (project) => {
    setStageTargetProject(project);
    setSelectedStage(project.cropDetails?.growthStage || 'planning');
    setShowStageModal(true);
  };

  const saveStage = async () => {
    if (!stageTargetProject) return;
    try {
      await FarmerCropProjectsService.updateProject(stageTargetProject.id, { cropDetails: { ...stageTargetProject.cropDetails, growthStage: selectedStage } });
      setShowStageModal(false);
      setStageTargetProject(null);
      await loadProjects();
    } catch (e) { Alert.alert('Error','Failed to update stage'); }
  };

  const advanceStage = async (project, nextStage) => {
    try {
      await FarmerCropProjectsService.updateProject(project.id, { cropDetails: { ...project.cropDetails, growthStage: nextStage } });
      await loadProjects();
    } catch (e) { Alert.alert('Error','Stage update failed'); }
  };

  const quickAddTask = async (project, label) => {
    try {
      await FarmerCropProjectsService.addTask(project.id, { label });
      await loadProjects();
    } catch (e) { /* ignore */ }
  };

  const completeTask = async (project, task) => {
    if (task.status === 'completed') return; // idempotent
    try {
      await FarmerCropProjectsService.completeTask(project.id, task.id);
      await loadProjects();
    } catch (e) { /* ignore */ }
  };

  const archiveProject = (project) => {
    Alert.alert(
      'Archive Crop',
      `Mark ${project.displayName} season as finished? You can still view history later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: async () => {
          try {
            await FarmerCropProjectsService.updateProject(project.id, { status: 'archived', archivedAt: new Date().toISOString() });
            await loadProjects();
          } catch (e) {
            Alert.alert('Error', 'Failed to archive crop');
          }
        }}
      ]
    );
  };

  const confirmDeleteProject = (project) => {
    Alert.alert(
      'Delete Crop',
      `Permanently delete ${project.displayName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await FarmerCropProjectsService.deleteProject(project.id);
            await loadProjects();
            Alert.alert('Deleted', `${project.displayName} removed`);
          } catch (e) {
            Alert.alert('Error','Failed to delete crop');
          }
        }}
      ]
    );
  };

  const unarchiveProject = (project) => {
    Alert.alert(
      'Unarchive Crop',
      `Bring ${project.displayName} back to active list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unarchive', onPress: async () => {
          try {
            await FarmerCropProjectsService.unarchiveProject(project.id);
            await loadProjects();
          } catch (e) { Alert.alert('Error','Failed to unarchive'); }
        }}
      ]
    );
  };

  const openTaskModal = (project) => {
    setTaskTargetProject(project);
    setNewTask({ label: '', dueDate: '' });
    setShowTaskModal(true);
  };

  const addTask = async () => {
    if (!newTask.label.trim()) { Alert.alert('Error','Enter task name'); return; }
    try {
      await FarmerCropProjectsService.addTask(taskTargetProject.id, newTask);
      setShowTaskModal(false);
      await loadProjects();
    } catch (e) { Alert.alert('Error','Failed to add task'); }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
  <Text style={styles.title}>{t('myCrops')}</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Analytics Summary */}
      {analytics && (
        <View style={styles.analyticsCard}>
          <View style={styles.analyticsRow}>
            <View style={styles.analyticItem}>
              <Text style={styles.analyticNumber}>{analytics.totalProjects}</Text>
              <Text style={styles.analyticLabel}>{t('cropsLabel')}</Text>
            </View>
            <View style={styles.analyticItem}>
              <Text style={styles.analyticNumber}>{analytics.activeProjects}</Text>
              <Text style={styles.analyticLabel}>{t('activeLabel')}</Text>
            </View>
            <View style={styles.analyticItem}>
              <Text style={styles.analyticNumber}>{analytics.totalArea}</Text>
              <Text style={styles.analyticLabel}>{t('acresLabel')}</Text>
            </View>
            <View style={styles.analyticItem}>
              <Text style={styles.analyticNumber}>{analytics.totalConversations}</Text>
              <Text style={styles.analyticLabel}>{t('chatsLabel')}</Text>
            </View>
          </View>
          {analytics.mostActiveCrop && (
            <Text style={styles.analyticsFooter}>
              {t('mostActive')}: {analytics.mostActiveCrop}
            </Text>
          )}
        </View>
      )}

      <FlatList
        data={projects}
        keyExtractor={(item)=> item.id}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading && (
          <View style={styles.centerContainer}>
            <Ionicons name="leaf-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>{t('noCropsYet')||'No Crops Yet'}</Text>
            <Text style={styles.emptySubtitle}>{t('noCropsSubtext')||'Create your first crop to get started with AI-powered farming guidance'}</Text>
            <TouchableOpacity style={styles.createFirstButton} onPress={()=> setShowCreateModal(true)}>
              <Text style={styles.createFirstText}>{t('addCrop')||'Create Crop'}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListHeaderComponent={loading && (
          <View style={styles.centerContainer}><Text style={styles.loadingText}>Loading crops...</Text></View>
        )}
        renderItem={({item: project}) => (
          <CropProjectCard
            project={project}
            nextText={`${t('nextLabel')||'Next'}: ${deriveNextTask(project)}`}
            expanded={expandedCardId === project.id}
            onToggleExpand={toggleExpand}
            onOpen={openProject}
            onAddTask={(p)=> openTaskModal(p)}
            onQuickAddTask={quickAddTask}
            onCompleteTask={completeTask}
            onAdvanceStage={advanceStage}
            onChangeStage={openStageWizard}
            onArchive={(p)=> archiveProject(p)}
            onUnarchive={(p)=> unarchiveProject(p)}
            onRequestDelete={confirmDeleteProject}
            t={t}
          />
        )}
      />

  {/* Create Crop Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('newCrop')||'New Crop'}</Text>
            <TouchableOpacity onPress={createProject}>
              <Text style={styles.createButton}>{t('createCrop')||'Create'}</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('cropName')||'Crop Name'} *</Text>
              <TextInput
                style={styles.input}
                value={newProject.cropName}
                onChangeText={(text) => setNewProject({...newProject, cropName: text})}
                placeholder={t('chooseYourCrop')||'e.g., Rice, Wheat, Cotton'}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('displayName')||'Display Name'}</Text>
              <TextInput
                style={styles.input}
                value={newProject.displayName}
                onChangeText={(text) => setNewProject({...newProject, displayName: text})}
                placeholder={t('displayName')||'Optional custom name'}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('varietyLabel')||'Variety'}</Text>
              <TextInput
                style={styles.input}
                value={newProject.variety}
                onChangeText={(text) => setNewProject({...newProject, variety: text})}
                placeholder={t('varietyPlaceholder')||'e.g., Basmati, IR64'}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('areaLabel')||'Area (acres)'}</Text>
              <TextInput
                style={styles.input}
                value={newProject.area}
                onChangeText={(text) => setNewProject({...newProject, area: text})}
                placeholder={t('areaPlaceholder')||'0'}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('season')||'Season'}</Text>
              <View style={styles.seasonButtons}>
                {['Kharif', 'Rabi', 'Zaid'].map((season) => (
                  <TouchableOpacity
                    key={season}
                    style={[
                      styles.seasonButton,
                      newProject.season === season && styles.seasonButtonActive
                    ]}
                    onPress={() => setNewProject({...newProject, season})}
                  >
                    <Text style={[
                      styles.seasonButtonText,
                      newProject.season === season && styles.seasonButtonTextActive
                    ]}>
                      {season}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('notesLabel')||'Notes'}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newProject.notes}
                onChangeText={(text) => setNewProject({...newProject, notes: text})}
                placeholder={t('notesPlaceholder')||'Any additional information...'}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Stage Wizard Modal */}
      <Modal visible={showStageModal} animationType="slide" transparent>
        <View style={styles.stageModalOverlay}>
          <View style={styles.stageModal}>
            <Text style={styles.stageTitle}>Update Growth Stage</Text>
            {['planning','sowing','vegetative','flowering','fruiting','maturity','harvest','postharvest'].map(st => (
              <TouchableOpacity key={st} style={[styles.stageOption, selectedStage===st && styles.stageOptionActive]} onPress={()=> setSelectedStage(st)}>
                <Text style={[styles.stageOptionText, selectedStage===st && styles.stageOptionTextActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.stageButtonsRow}>
              <TouchableOpacity onPress={()=> setShowStageModal(false)} style={styles.stageCancelBtn}><Text style={styles.stageCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveStage} style={styles.stageSaveBtn}><Text style={styles.stageSaveText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task Modal */}
      <Modal visible={showTaskModal} animationType="slide" transparent>
        <View style={styles.taskModalWrap}>
          <View style={styles.taskModalCard}>
            <Text style={styles.taskModalTitle}>Add Task {taskTargetProject ? `- ${taskTargetProject.displayName}` : ''}</Text>
            <TextInput
              style={styles.input}
              placeholder="Task label"
              value={newTask.label}
              onChangeText={text => setNewTask({ ...newTask, label: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Due Date (YYYY-MM-DD optional)"
              value={newTask.dueDate}
              onChangeText={text => setNewTask({ ...newTask, dueDate: text })}
            />
            <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:12 }}>
              <TouchableOpacity onPress={() => setShowTaskModal(false)} style={styles.modalBtnSecondary}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={addTask} style={styles.modalBtnPrimary}><Text style={{ color:'#fff' }}>Add</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  },
  analyticsCard: {
    backgroundColor: colors.cardBackground,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticItem: {
    alignItems: 'center',
  },
  analyticNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  analyticLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  analyticsFooter: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(45, 106, 79, 0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 32,
    lineHeight: 20,
  },
  createFirstButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  createFirstText: {
    color: '#fff',
    fontWeight: '600',
  },
  projectsGrid: {
    flexDirection: 'column'
  },
  projectCard: {
    width: '100%',
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.08)'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cropEmoji: {
    fontSize: 32,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stageBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stageBadgeText: {
    fontSize: 10,
    textTransform: 'capitalize',
    color: colors.primary,
    fontWeight: '600',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  alertBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  nextTaskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  marginTop: 4,
  marginBottom: 6,
  },
  nextTaskText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
  },
  taskAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  badgeRow: {
    flexDirection:'row',
    alignItems:'center',
    flexWrap:'wrap',
    gap:6,
    marginBottom:4
  },
  inlineBadge: {
    flexDirection:'row',
    alignItems:'center',
    backgroundColor: colors.danger,
    paddingHorizontal:6,
    paddingVertical:2,
    borderRadius:10,
    gap:4
  },
  inlineBadgeText: { color:'#fff', fontSize:11, fontWeight:'600' },
  metaText: { fontSize:11, color: colors.textSecondary },
  actionsRow: {
    flexDirection:'row',
    justifyContent:'space-between',
    marginTop:8
  },
  actionIcon: {
    alignItems:'center',
    flex:1
  },
  actionLabel: { fontSize:10, color: colors.primary, marginTop:2, fontWeight:'600' },
  expandedSection: {
    marginTop:10,
    backgroundColor:'rgba(45,106,79,0.05)',
    borderRadius:12,
    padding:10
  },
  sectionTitle: { fontSize:12, fontWeight:'700', color: colors.textPrimary, marginBottom:6, letterSpacing:0.5 },
  emptyMiniText: { fontSize:11, color: colors.textSecondary, fontStyle:'italic' },
  taskDueMini: { fontSize:10, color: colors.textSecondary },
  taskAddText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600'
  },
  taskModalWrap: {
    flex:1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  taskModalCard: {
    width: '90%',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    elevation: 6
  },
  taskModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12
  },
  modalBtnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginRight: 10
  },
  modalBtnPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary
  },
  projectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cropName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  variety: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardDetails: {
    marginBottom: 8,
  },
  detailText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  lastAccessed: {
    fontSize: 10,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45, 106, 79, 0.1)',
  },
  cancelButton: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  createButton: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.1)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  seasonButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  seasonButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.2)',
    alignItems: 'center',
  },
  seasonButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  seasonButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  seasonButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  taskList: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 6
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4
  },
  taskLabel: {
    fontSize: 12,
    flex: 1,
    color: colors.textPrimary
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary
  },
  taskDue: {
    fontSize: 10,
    color: colors.textSecondary
  },
  moreTasks: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'right'
  },
  stageModalOverlay: {
    flex:1,
    backgroundColor:'rgba(0,0,0,0.4)',
    justifyContent:'center',
    alignItems:'center'
  },
  stageModal: {
    width:'85%',
    backgroundColor:'#fff',
    borderRadius:16,
    padding:20
  },
  stageTitle: {
    fontSize:18,
    fontWeight:'700',
    marginBottom:12,
    color: colors.textPrimary
  },
  stageOption: {
    paddingVertical:8,
    borderWidth:1,
    borderColor:'rgba(0,0,0,0.1)',
    borderRadius:8,
    paddingHorizontal:12,
    marginBottom:6
  },
  stageOptionActive: {
    backgroundColor:'rgba(45,106,79,0.15)',
    borderColor: colors.primary
  },
  stageOptionText: {
    fontSize:14,
    textTransform:'capitalize',
    color: colors.textPrimary
  },
  stageOptionTextActive: {
    fontWeight:'700',
    color: colors.primary
  },
  stageButtonsRow: {
    flexDirection:'row',
    justifyContent:'flex-end',
    marginTop:12
  },
  stageCancelBtn: {
    paddingVertical:10,
    paddingHorizontal:16,
    marginRight:8
  },
  stageCancelText: {
    color: colors.textSecondary
  },
  stageSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical:10,
    paddingHorizontal:20,
    borderRadius:8
  },
  stageSaveText: {
    color:'#fff',
    fontWeight:'600'
  }
});

export default CropProjectsScreen;
