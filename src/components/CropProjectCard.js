import React, { useState, useCallback, memo, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { spacing, radius } from '../styles/layout';

// Ordered growth stages
const STAGES = ['planning','sowing','vegetative','flowering','fruiting','maturity','harvest','postharvest'];

/** Decide single primary badge (alerts > overdue > tasks > stage) */
function getPrimaryBadge(project, t) {
  const alerts = project.workflows?.alerts || [];
  const critical = alerts.find(a => a.severity === 'critical');
  if (critical) return { type: 'alert', icon: 'warning', color: colors.danger, text: t('alertLabel')||'Alert' };
  const high = alerts.find(a => a.severity === 'high');
  if (high) return { type: 'alert', icon: 'warning', color: colors.warning || colors.danger, text: t('alertLabel')||'Alert' };
  const tasks = project.workflows?.tasks || [];
  const now = Date.now();
  const overdue = tasks.some(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate).getTime() < now);
  if (overdue) return { type: 'overdue', icon: 'flame', color: '#b71c1c', text: t('overdueLabel')||'Overdue' };
  if (alerts.length) return { type: 'alert', icon: 'warning', color: colors.danger, text: `${alerts.length}` };
  return { type: 'stage', icon: 'leaf', color: colors.primary, text: project.cropDetails?.growthStage || t('stageLabel')||'stage' };
}

function getCropEmoji(name) {
  const emojiMap = { rice:'🌾', wheat:'🌾', cotton:'🌿', sugarcane:'🎋', corn:'🌽', maize:'🌽', tomato:'🍅', potato:'🥔', onion:'🧅', soybean:'🫘', groundnut:'🥜' };
  return emojiMap[name?.toLowerCase()] || '🌱';
}

function formatRelativeDate(ts) {
  if (!ts) return '';
  const d = new Date(ts); const now = new Date();
  const diffH = (now - d) / 3600000;
  if (diffH < 6) return 'Just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = diffH/24;
  if (diffD < 7) return `${Math.floor(diffD)}d ago`;
  return d.toLocaleDateString();
}

const CropProjectCard = memo(({
  project,
  nextText,
  expanded,
  onToggleExpand,
  onOpen,
  onAddTask,
  onQuickAddTask,
  onCompleteTask,
  onAdvanceStage,
  onChangeStage,
  onArchive,
  onUnarchive,
  onRequestDelete,
  t
}) => {
  const [quickTask, setQuickTask] = useState('');
  const primary = getPrimaryBadge(project, t);
  const tasks = project.workflows?.tasks || [];
  const stage = project.cropDetails?.growthStage || 'planning';
  const stageIdx = STAGES.indexOf(stage);
  const nextStage = stageIdx >=0 && stageIdx < STAGES.length-1 ? STAGES[stageIdx+1] : null;

  const handleQuickAdd = useCallback(() => {
    if (quickTask.trim().length === 0) return;
    onQuickAddTask(project, quickTask.trim());
    setQuickTask('');
  }, [quickTask, project, onQuickAddTask]);

  const dueStyle = (task) => {
    if (!task.dueDate || task.status==='completed') return null;
    const overdue = new Date(task.dueDate).getTime() < Date.now();
    return overdue ? styles.overdueText : styles.dueText;
  };

  // Long press (press & hold 2s) detection for delete confirmation
  const holdTimerRef = useRef(null);
  const [holding, setHolding] = useState(false);

  const startHold = () => {
    setHolding(true);
    holdTimerRef.current = setTimeout(() => {
      setHolding(false);
      // Fire delete confirm
      if (onRequestDelete) {
        onRequestDelete(project);
      } else {
        Alert.alert('Delete Crop', `Delete ${project.displayName}? This cannot be undone.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: ()=> {} }
        ]);
      }
    }, 1000); // 2 seconds hold
  };

  const cancelHold = () => {
    setHolding(false);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  return (
    <Pressable
      style={[styles.card, holding && styles.cardHolding]}
      onPressIn={startHold}
      onPressOut={cancelHold}
      delayLongPress={1000}
    >
      {/* Top Row */}
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.emoji}>{getCropEmoji(project.cropName)}</Text>
          <View style={{flex:1}}>
            <Text style={styles.name} numberOfLines={1}>{project.displayName}</Text>
            <Text style={styles.subName} numberOfLines={1}>{project.cropName}</Text>
          </View>
        </View>
        <View style={[styles.badge,{backgroundColor: primary.color}]}> 
          <Ionicons name={primary.icon} size={12} color="#fff" />
          <Text style={styles.badgeText}>{primary.text}</Text>
        </View>
      </View>

      {/* Next Action */}
      <View style={styles.nextRow}>
        <Ionicons name='checkmark-circle' size={16} color={colors.primary} />
        <Text style={styles.nextText} numberOfLines={2}>{nextText}</Text>
      </View>

      {/* Core Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actBtn} onPress={()=> onOpen(project)}>
          <Ionicons name='chatbubbles' size={18} color={colors.primary} />
          <Text style={styles.actLabel}>{t('openLabel')||'Open'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actBtn} onPress={()=> onAddTask(project)}>
          <Ionicons name='add-circle' size={18} color={colors.primary} />
          <Text style={styles.actLabel}>{t('taskLabel')||'Task'}</Text>
        </TouchableOpacity>
        {nextStage && (
          <TouchableOpacity style={styles.actBtn} onPress={()=> onAdvanceStage(project, nextStage)}>
            <Ionicons name='trending-up' size={18} color={colors.primary} />
            <Text style={styles.actLabel}>{`→ ${t(`stage_${nextStage}`) || nextStage}`}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actBtn} onPress={()=> onToggleExpand(project.id)}>
          <Ionicons name={expanded? 'chevron-up':'chevron-down'} size={18} color={colors.primary} />
          <Text style={styles.actLabel}>{expanded? t('lessLabel')||'Less': t('moreLabel')||'More'}</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expandSection}>
          {/* Quick Stats */}
          <View style={styles.metaRow}>
            {project.cropDetails?.area>0 && <Text style={styles.meta}>{project.cropDetails.area} ac</Text>}
            {project.cropDetails?.variety ? <Text style={styles.meta}>• {project.cropDetails.variety}</Text> : null}
            <Text style={[styles.meta,{marginLeft:'auto'}]}>{formatRelativeDate(project.lastAccessed)}</Text>
          </View>

          {/* Tasks */}
          <Text style={styles.sectionTitle}>{t('tasksLabel')||'Tasks'}</Text>
          {tasks.length===0 && <Text style={styles.emptyText}>{t('noTasksYet')||'No tasks yet'}</Text>}
          {tasks.slice(0,5).map(task => (
            <TouchableOpacity key={task.id} style={styles.taskRow} onPress={()=> onCompleteTask(project, task)}>
              <Ionicons name={task.status==='completed'? 'checkbox':'square-outline'} size={16} color={task.status==='completed'? colors.primary : '#666'} />
              <Text style={[styles.taskLabel, task.status==='completed' && styles.taskDone]} numberOfLines={1}>{task.label}</Text>
              {task.dueDate && <Text style={[styles.taskDue, dueStyle(task)]}>{task.dueDate}</Text>}
            </TouchableOpacity>
          ))}
          {tasks.length>5 && <Text style={styles.moreText}>+{tasks.length-5}</Text>}

          {/* Quick Add */}
          <View style={styles.quickAddRow}>
            <TextInput
              style={styles.quickInput}
              placeholder={t('addFirstTask')||'Add your first task'}
              value={quickTask}
              onChangeText={setQuickTask}
              onSubmitEditing={handleQuickAdd}
              returnKeyType='done'
            />
            <TouchableOpacity style={styles.quickBtn} onPress={handleQuickAdd}>
              <Ionicons name='add' size={18} color='#fff' />
            </TouchableOpacity>
          </View>

          {/* Secondary Actions */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity onPress={()=> onChangeStage(project)} style={styles.secondaryBtn}><Text style={styles.secondaryText}>{t('updateGrowthStage')||'Update Growth Stage'}</Text></TouchableOpacity>
            {project.status==='archived' ? (
              <TouchableOpacity onPress={()=> onUnarchive(project)} style={styles.secondaryBtn}><Text style={styles.secondaryText}>{t('unarchive')||'Unarchive'}</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={()=> onArchive(project)} style={styles.secondaryBtn}><Text style={styles.secondaryText}>{t('archive')||'Archive'}</Text></TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card:{ backgroundColor: colors.cardBackground, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth:1, borderColor:'rgba(45,106,79,0.08)' },
  cardHolding:{
    borderColor: colors.danger,
    transform:[{ scale: 0.98 }]
  },
  topRow:{flexDirection:'row', justifyContent:'space-between', alignItems:'center'},
  titleWrap:{flexDirection:'row', alignItems:'center', flex:1},
  emoji:{fontSize:34, marginRight:8},
  name:{fontSize:15, fontWeight:'700', color: colors.textPrimary},
  subName:{fontSize:11, color: colors.textSecondary, marginTop:2},
  badge:{flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingVertical:4, borderRadius:12, gap:4},
  badgeText:{color:'#fff', fontSize:11, fontWeight:'600', textTransform:'capitalize'},
  nextRow:{flexDirection:'row', alignItems:'flex-start', marginTop: spacing.xs, gap:8},
  nextText:{flex:1, fontSize:12, color: colors.textPrimary, lineHeight:16},
  actionsRow:{flexDirection:'row', justifyContent:'space-between', marginTop: spacing.sm},
  actBtn:{alignItems:'center', flex:1},
  actLabel:{marginTop:2, fontSize:10, color: colors.primary, fontWeight:'600'},
  expandSection:{marginTop: spacing.sm, backgroundColor:'rgba(45,106,79,0.05)', borderRadius: radius.lg, padding: spacing.sm},
  metaRow:{flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom: spacing.xs},
  meta:{fontSize:11, color: colors.textSecondary},
  sectionTitle:{fontSize:11, fontWeight:'700', color: colors.textPrimary, marginBottom:4},
  emptyText:{fontSize:11, fontStyle:'italic', color: colors.textSecondary, marginBottom:4},
  taskRow:{flexDirection:'row', alignItems:'center', paddingVertical:3},
  taskLabel:{flex:1, fontSize:11, color: colors.textPrimary, marginLeft:6},
  taskDone:{textDecorationLine:'line-through', color: colors.textSecondary},
  taskDue:{fontSize:10, color: colors.textSecondary},
  moreText:{textAlign:'right', fontSize:10, color: colors.textSecondary, marginTop:2},
  quickAddRow:{flexDirection:'row', alignItems:'center', marginTop: spacing.xs},
  quickInput:{flex:1, backgroundColor:'#fff', borderRadius:8, borderWidth:1, borderColor:'rgba(45,106,79,0.15)', paddingHorizontal:10, paddingVertical:6, fontSize:11},
  quickBtn:{marginLeft:8, backgroundColor: colors.primary, padding:10, borderRadius:10},
  secondaryRow:{marginTop:12, flexDirection:'row', flexWrap:'wrap', gap:8},
  secondaryBtn:{backgroundColor:'rgba(45,106,79,0.12)', paddingHorizontal:12, paddingVertical:8, borderRadius:10},
  secondaryText:{fontSize:11, color: colors.primary, fontWeight:'600'},
  overdueText:{color:'#b71c1c'},
  dueText:{color: colors.primary}
});

export default CropProjectCard;
