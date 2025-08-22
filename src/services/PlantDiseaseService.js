/**
 * Plant Disease Detection Service for Khet AI
 * Uses plant identification APIs and knowledge base for disease detection
 */

import EnvironmentConfig from '../config/environment.js';

class PlantDiseaseService {
  static PLANTNET_API_URL = 'https://my-api.plantnet.org/v2/identify';
  
  static getPlantNetApiKey() {
    return EnvironmentConfig.getPlantNetApiKey() || 
           EnvironmentConfig.getApiKeysFromMemory()?.plantnet;
  }
  
  // Real plant disease APIs - Updated with working endpoints
  static REAL_DISEASE_APIS = [
    {
      name: 'PlantNet',
      url: 'https://my-api.plantnet.org/v2/identify',
      requiresKey: true,
      project: 'weurope' // Default project for European flora
    },
    {
      name: 'iNaturalist',
      url: 'https://api.inaturalist.org/v1/identifications',
      requiresKey: false
    }
  ];

  // Analyze plant image using PlantNet API
  static async analyzePlantImage(imageUri, cropType = 'unknown') {
    try {
      // First try PlantNet API if key is available
      const plantNetKey = this.getPlantNetApiKey();
      if (plantNetKey && imageUri) {
        const plantNetResult = await this.callPlantNetAPI(imageUri, cropType);
        if (plantNetResult.success) {
          return plantNetResult;
        }
      }

      // Fallback to symptom-based analysis
      console.log('Using fallback disease detection...');
      return await this.analyzePlantSymptoms(imageUri, cropType);

    } catch (error) {
      console.error('Plant disease analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Call PlantNet API for plant identification - Fixed endpoint
  static async callPlantNetAPI(imageUri, cropType) {
    try {
      const plantNetKey = this.getPlantNetApiKey();
      if (!plantNetKey) {
        throw new Error('PlantNet API key not configured');
      }

      const formData = new FormData();
      formData.append('images', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'plant_image.jpg'
      });
      formData.append('modifiers', '["crops", "useful"]');
      formData.append('plant-details', '["common_names"]');

      // Use correct PlantNet API endpoint format
      const response = await fetch(
        `${this.PLANTNET_API_URL}/weurope?api-key=${plantNetKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          body: formData
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('PlantNet API key is invalid or expired');
        }
        throw new Error(`PlantNet API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process PlantNet response
      const analysis = this.processPlantNetResponse(data, cropType);
      
      return {
        success: true,
        source: 'PlantNet API',
        analysis,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('PlantNet API error:', error);
      return {
        success: false,
        error: error.message,
        source: 'PlantNet API'
      };
    }
  }

  // Analyze plant symptoms using real APIs and comprehensive disease database
  static async analyzePlantSymptoms(imageUri, cropType, symptoms = []) {
    try {
      console.log('🔬 Analyzing plant symptoms...');
      
      // First try PlantNet API if key is available and image provided
      if (imageUri) {
        const plantNetKey = this.getPlantNetApiKey();
        if (plantNetKey) {
          try {
            const plantNetResult = await this.callPlantNetAPI(imageUri, cropType);
            if (plantNetResult.success) {
              return plantNetResult;
            }
          } catch (apiError) {
            console.warn('PlantNet API failed:', apiError.message);
          }
        }
      }

      // Fallback to symptom-based analysis using knowledge base
      const diseaseAnalysis = this.analyzeSymptomsBased(cropType, symptoms);
      
      return {
        success: true,
        source: 'SYMPTOM_BASED_ANALYSIS',
        analysis: diseaseAnalysis,
        timestamp: new Date().toISOString(),
        note: 'Analysis based on symptom patterns and crop disease database'
      };

    } catch (error) {
      console.error('❌ Plant disease analysis failed:', error);
      
      // Return helpful fallback information
      return {
        success: true,
        error: `Disease detection APIs unavailable: ${error.message}`,
        source: 'KNOWLEDGE_BASE',
        analysis: {
          possibleDiseases: this.getCommonDiseasesFromKnowledgeBase(cropType),
          generalAdvice: this.getGeneralDiseaseAdvice(cropType),
          symptoms: symptoms
        },
        recommendations: [
          'Consult local agricultural extension officer for accurate diagnosis',
          'Take clear photos of affected plant parts',
          'Note environmental conditions (weather, soil moisture)',
          'Consider soil and water testing',
          'Monitor disease progression over time'
        ],
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get disease information by name
  static async getDiseaseInfo(diseaseName, cropType) {
    try {
      const diseaseInfo = this.getDiseaseFromDatabase(diseaseName, cropType);
      
      return {
        success: true,
        disease: diseaseName,
        cropType,
        info: diseaseInfo,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Disease info error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get preventive measures for a crop
  static getPreventiveMeasures(cropType) {
    const generalMeasures = [
      'Use certified disease-free seeds',
      'Maintain proper plant spacing for air circulation',
      'Avoid overhead watering to reduce leaf wetness',
      'Remove and destroy infected plant debris',
      'Rotate crops to break disease cycles',
      'Apply balanced fertilization',
      'Monitor plants regularly for early detection'
    ];

    const cropSpecificMeasures = {
      'wheat': [
        'Use rust-resistant varieties',
        'Apply fungicide at flag leaf stage',
        'Avoid late sowing'
      ],
      'rice': [
        'Maintain proper water levels',
        'Avoid excessive nitrogen',
        'Use blast-resistant varieties'
      ],
      'cotton': [
        'Use Bt cotton varieties',
        'Monitor for bollworm',
        'Practice crop rotation'
      ],
      'tomato': [
        'Use disease-resistant varieties',
        'Mulch around plants',
        'Support plants properly'
      ]
    };

    const specific = cropSpecificMeasures[cropType.toLowerCase()] || [];
    return [...generalMeasures, ...specific];
  }

  // Analyze symptoms using knowledge base
  static analyzeSymptomsBased(cropType, symptoms) {
    const analysis = {
      cropType,
      symptoms,
      possibleDiseases: [],
      confidence: 'medium',
      recommendations: []
    };

    // Match symptoms to known disease patterns
    const diseasePatterns = this.getDiseasePatterns(cropType);
    
    symptoms.forEach(symptom => {
      const matches = diseasePatterns.filter(pattern => 
        pattern.symptoms.some(s => 
          s.toLowerCase().includes(symptom.toLowerCase()) ||
          symptom.toLowerCase().includes(s.toLowerCase())
        )
      );
      
      matches.forEach(match => {
        if (!analysis.possibleDiseases.find(d => d.name === match.name)) {
          analysis.possibleDiseases.push({
            name: match.name,
            probability: this.calculateProbability(symptoms, match.symptoms),
            treatment: match.treatment,
            prevention: match.prevention
          });
        }
      });
    });

    // Sort by probability
    analysis.possibleDiseases.sort((a, b) => b.probability - a.probability);
    
    // Add general recommendations
    analysis.recommendations = this.getGeneralDiseaseAdvice(cropType);

    return analysis;
  }

  // Get disease patterns for symptom matching
  static getDiseasePatterns(cropType) {
    const patterns = {
      'wheat': [
        {
          name: 'Rust (Yellow/Brown)',
          symptoms: ['yellow spots', 'brown spots', 'pustules', 'orange powder'],
          treatment: ['Fungicide application', 'Remove affected leaves'],
          prevention: ['Resistant varieties', 'Proper spacing']
        },
        {
          name: 'Powdery Mildew',
          symptoms: ['white powdery coating', 'gray patches', 'stunted growth'],
          treatment: ['Sulfur-based fungicide', 'Improve air circulation'],
          prevention: ['Avoid overhead watering', 'Plant resistant varieties']
        }
      ],
      'rice': [
        {
          name: 'Blast Disease',
          symptoms: ['eye-shaped spots', 'gray centers', 'brown borders', 'wilting'],
          treatment: ['Tricyclazole fungicide', 'Balanced fertilization'],
          prevention: ['Avoid excess nitrogen', 'Proper water management']
        },
        {
          name: 'Bacterial Blight',
          symptoms: ['yellow streaks', 'water-soaked lesions', 'wilting'],
          treatment: ['Copper-based bactericide', 'Remove infected plants'],
          prevention: ['Use certified seeds', 'Avoid injury to plants']
        }
      ],
      'tomato': [
        {
          name: 'Early Blight',
          symptoms: ['dark spots with rings', 'yellow halos', 'leaf drop'],
          treatment: ['Chlorothalonil fungicide', 'Remove affected leaves'],
          prevention: ['Crop rotation', 'Mulching']
        },
        {
          name: 'Late Blight',
          symptoms: ['water-soaked spots', 'white mold', 'rapid spreading'],
          treatment: ['Metalaxyl fungicide', 'Destroy infected plants'],
          prevention: ['Avoid overhead watering', 'Resistant varieties']
        }
      ],
      'cotton': [
        {
          name: 'Bollworm',
          symptoms: ['holes in bolls', 'caterpillar presence', 'damaged flowers'],
          treatment: ['Bt spray', 'Insecticide application'],
          prevention: ['Bt cotton varieties', 'Monitor regularly']
        },
        {
          name: 'Fusarium Wilt',
          symptoms: ['yellowing leaves', 'wilting', 'vascular browning'],
          treatment: ['Remove infected plants', 'Soil treatment'],
          prevention: ['Resistant varieties', 'Crop rotation']
        }
      ]
    };

    return patterns[cropType.toLowerCase()] || patterns['tomato']; // Default pattern
  }

  // Calculate probability based on symptom matching
  static calculateProbability(reportedSymptoms, diseaseSymptoms) {
    let matchCount = 0;
    reportedSymptoms.forEach(reported => {
      diseaseSymptoms.forEach(disease => {
        if (reported.toLowerCase().includes(disease.toLowerCase()) ||
            disease.toLowerCase().includes(reported.toLowerCase())) {
          matchCount++;
        }
      });
    });
    
    return Math.min(matchCount / diseaseSymptoms.length, 1.0);
  }

  // Get common diseases from knowledge base
  static getCommonDiseasesFromKnowledgeBase(cropType) {
    const commonDiseases = {
      'wheat': ['Rust', 'Powdery Mildew', 'Septoria Leaf Spot', 'Fusarium Head Blight'],
      'rice': ['Blast Disease', 'Bacterial Blight', 'Sheath Blight', 'Brown Spot'],
      'cotton': ['Bollworm', 'Fusarium Wilt', 'Bacterial Blight', 'Verticillium Wilt'],
      'tomato': ['Early Blight', 'Late Blight', 'Fusarium Wilt', 'Bacterial Spot'],
      'potato': ['Late Blight', 'Early Blight', 'Potato Virus Y', 'Black Scurf'],
      'corn': ['Corn Borer', 'Gray Leaf Spot', 'Common Rust', 'Northern Corn Leaf Blight']
    };

    return commonDiseases[cropType.toLowerCase()] || ['Consult agricultural expert for crop-specific diseases'];
  }

  // Get general disease advice
  static getGeneralDiseaseAdvice(cropType) {
    return [
      'Monitor plants regularly for early disease detection',
      'Maintain proper plant spacing for air circulation',
      'Use certified disease-free seeds',
      'Practice crop rotation to break disease cycles',
      'Apply balanced fertilization to strengthen plants',
      'Remove and destroy infected plant debris',
      'Consider integrated pest management approaches',
      'Consult local agricultural extension officer for severe cases'
    ];
  }

  // Process PlantNet API response
  static processPlantNetResponse(data, cropType) {
    const results = data.results || [];
    const analysis = {
      plantIdentification: [],
      healthStatus: 'unknown',
      confidence: 0
    };

    results.forEach(result => {
      analysis.plantIdentification.push({
        scientificName: result.species?.scientificNameWithoutAuthor || 'Unknown',
        commonNames: result.species?.commonNames || [],
        confidence: result.score || 0,
        family: result.species?.family?.scientificNameWithoutAuthor || 'Unknown'
      });
    });

    // Set overall confidence
    if (analysis.plantIdentification.length > 0) {
      analysis.confidence = analysis.plantIdentification[0].confidence;
    }

    return analysis;
  }

  // Get disease from database (placeholder for now)
  static getDiseaseFromDatabase(diseaseName, cropType) {
    const diseaseDatabase = this.getDiseasePatterns(cropType);
    const disease = diseaseDatabase.find(d => 
      d.name.toLowerCase().includes(diseaseName.toLowerCase())
    );

    if (disease) {
      return {
        name: disease.name,
        symptoms: disease.symptoms,
        treatment: disease.treatment,
        prevention: disease.prevention,
        cropType: cropType
      };
    }

    return {
      name: diseaseName,
      symptoms: ['Consult expert for specific symptoms'],
      treatment: ['Seek professional advice'],
      prevention: this.getGeneralDiseaseAdvice(cropType),
      cropType: cropType
    };
  }
}

export default PlantDiseaseService;
