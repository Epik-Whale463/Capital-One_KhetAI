import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import NewsFlashcard from '../components/NewsFlashcard';
import NewsFlashcardService from '../services/NewsFlashcardService';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../localization/translations';

const AgriNewsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [flashcards, setFlashcards] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { t } = useTranslation(user?.language);

  const load = async (force=false) => {
    setError(null);
    try {
      const service = NewsFlashcardService.getInstance();
      const result = await service.getFlashcards(force);
      setFlashcards(result.flashcards);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(()=>{ load(); }, []);

  const onRefresh = useCallback(()=>{
    setRefreshing(true);
    load(true);
  }, []);

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={{ flex:1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}> 
          <Text style={styles.title}>Agri News Flashcards</Text>
          <TouchableOpacity onPress={()=>load(true)} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.center}> 
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching latest agriculture news...</Text>
          </View>
        ) : (
          <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.scrollContent}>
            {error && <Text style={styles.error}>{error}</Text>}
            {flashcards.length === 0 && !error && (
              <Text style={styles.empty}>No news found right now. Pull to refresh.</Text>
            )}
            {flashcards.map(card => <NewsFlashcard key={card.id} card={card} />)}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex:1 },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12 },
  title: { fontSize:18, fontWeight:'700', color: colors.textPrimary },
  refreshBtn: { padding:8, borderRadius:12, backgroundColor: colors.cardBackground, borderWidth:1, borderColor:'rgba(0,0,0,0.08)' },
  center: { flex:1, justifyContent:'center', alignItems:'center', padding:24 },
  loadingText: { marginTop:12, fontSize:14, color: colors.textSecondary },
  scrollContent: { padding:16, paddingBottom:80 },
  error: { color: colors.danger, marginBottom:12 },
  empty: { fontSize:14, color: colors.textSecondary, textAlign:'center', marginTop:20 }
});

export default AgriNewsScreen;
