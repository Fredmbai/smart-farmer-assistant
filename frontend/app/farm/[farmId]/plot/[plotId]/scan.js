import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import * as visionService from '../../../../../src/api/visionService';
import { Colors } from '../../../../../src/constants/colors';

// ── Helpers ───────────────────────────────────────────────────────────
const DIAGNOSIS_META = {
  healthy:      { emoji: '✅', label: 'Healthy',      bg: '#E8F5E9' },
  early_blight: { emoji: '⚠️', label: 'Early Blight', bg: '#FFF8E1' },
  late_blight:  { emoji: '🚨', label: 'Late Blight',  bg: '#FFEBEE' },
};
const diagMeta = (d) => DIAGNOSIS_META[d] ?? { emoji: '❓', label: 'Unknown', bg: '#F5F5F5' };

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────
export default function ScanScreen() {
  const { farmId, plotId } = useLocalSearchParams();
  const router = useRouter();

  const [image,    setImage]    = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result,   setResult]   = useState(null);
  const [history,  setHistory]  = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const data = await visionService.getScans(plotId);
      setHistory(Array.isArray(data) ? data : []);
    } catch (_) {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, [plotId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const resetState = () => {
    setImage(null);
    setResult(null);
    setScanning(false);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled) {
      setImage(res.assets[0].uri);
      setResult(null);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled) {
      setImage(res.assets[0].uri);
      setResult(null);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;
    setScanning(true);
    try {
      const data = await visionService.scanImage(plotId, image);
      setResult(data);
      loadHistory();
    } catch (_) {
      setResult({ diagnosis: 'unknown', confidence: 0, recommendation: 'Analysis failed. Please try again.' });
    } finally {
      setScanning(false);
    }
  };

  const meta        = result ? diagMeta(result.diagnosis) : null;
  const confidence  = result ? Math.round((result.confidence ?? 0) * 100) : 0;
  const isDisease   = result?.diagnosis === 'early_blight' || result?.diagnosis === 'late_blight';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#0E3D22', '#1B6B3A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Disease Scan</Text>
        <Text style={s.headerSub} numberOfLines={1}>Plot: {plotId}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Scan Area ──────────────────────────────────────────── */}
        {!image && !result && (
          <View style={s.dropZone}>
            <Text style={s.dropEmoji}>📸</Text>
            <Text style={s.dropTitle}>Take a photo of a potato leaf</Text>
            <Text style={s.dropSub}>Clear, close-up photos give better results</Text>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.btnPrimary} onPress={takePhoto}>
                <Text style={s.btnPrimaryText}>📷 Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnOutline} onPress={pickFromGallery}>
                <Text style={s.btnOutlineText}>🖼️ Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!!image && !result && (
          <>
            <View style={s.imageBox}>
              <Image source={{ uri: image }} style={s.previewImage} resizeMode="cover" />
              {scanning && (
                <View style={s.overlay}>
                  <ActivityIndicator color="#FFFFFF" size="large" />
                  <Text style={s.overlayTitle}>Analyzing leaf...</Text>
                  <Text style={s.overlaySub}>This may take a few seconds</Text>
                </View>
              )}
            </View>
            {!scanning && (
              <>
                <Text style={s.previewPrompt}>Scan this image?</Text>
                <View style={s.btnRow}>
                  <TouchableOpacity style={s.btnPrimary} onPress={analyzeImage}>
                    <Text style={s.btnPrimaryText}>🔍 Analyze</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnOutline} onPress={resetState}>
                    <Text style={s.btnOutlineText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        {!!result && (
          <>
            {/* Thumbnail */}
            {!!image && (
              <Image source={{ uri: image }} style={s.thumbImage} resizeMode="cover" />
            )}

            {/* Result card */}
            <View style={[s.resultCard, { backgroundColor: meta.bg }]}>
              <Text style={s.resultEmoji}>{meta.emoji}</Text>
              <Text style={s.resultTitle}>{meta.label}</Text>

              {/* Confidence bar */}
              <Text style={s.confLabel}>Confidence: {confidence}%</Text>
              <View style={s.confTrack}>
                <View style={[s.confFill, { width: `${confidence}%` }]} />
              </View>

              {/* Recommendation */}
              {!!result.recommendation && (
                <Text style={s.recommendation}>{result.recommendation}</Text>
              )}

              {/* Disease warning */}
              {isDisease && (
                <View style={s.alertWarning}>
                  <Text style={s.alertWarningText}>
                    ⚠️ Alert created — check your Alerts tab
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={s.btnPrimary} onPress={resetState}>
              <Text style={s.btnPrimaryText}>Scan Another</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── History ────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Previous Scans</Text>
        {histLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <Text style={s.noHistory}>No previous scans for this plot</Text>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item, i) => String(item.id ?? i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            renderItem={({ item }) => {
              const hm = diagMeta(item.diagnosis);
              const hConf = Math.round((item.confidence ?? 0) * 100);
              return (
                <View style={hist.card}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={hist.thumb} />
                  ) : (
                    <View style={[hist.thumb, { backgroundColor: hm.bg, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 24 }}>{hm.emoji}</Text>
                    </View>
                  )}
                  <View style={[hist.dot, { backgroundColor: hm.bg === '#E8F5E9' ? Colors.success : hm.bg === '#FFF8E1' ? Colors.warning : Colors.error }]} />
                  <Text style={hist.diag}>{hm.label}</Text>
                  <Text style={hist.conf}>{hConf}% confident</Text>
                  <Text style={hist.time}>{timeAgo(item.created_at)}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  back:        { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 5, fontWeight: '500' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub:   { fontSize: 11, color: Colors.primaryLight, marginTop: 2 },
  scroll:      { padding: 16 },

  dropZone: {
    borderWidth: 2,
    borderColor: '#B0BEC5',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
    gap: 8,
    padding: 20,
  },
  dropEmoji: { fontSize: 52 },
  dropTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  dropSub:   { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  btnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnOutlineText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },

  imageBox: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  previewImage: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  overlaySub:   { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  previewPrompt:{ fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center', marginBottom: 8 },

  thumbImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginBottom: 12,
  },
  resultCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  resultEmoji:{ fontSize: 56, marginBottom: 8 },
  resultTitle:{ fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 12 },

  confLabel:  { fontSize: 13, color: Colors.textSecondary, alignSelf: 'flex-start', marginBottom: 6 },
  confTrack:  { width: '100%', height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  confFill:   { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },

  recommendation: { fontSize: 15, color: Colors.text, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  alertWarning: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
    width: '100%',
  },
  alertWarningText: { fontSize: 13, color: Colors.error, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12, marginTop: 8 },
  noHistory:    { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
});

const hist = StyleSheet.create({
  card: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  thumb: { width: 70, height: 60, borderRadius: 8, marginBottom: 6 },
  dot:   { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  diag:  { fontSize: 11, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  conf:  { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  time:  { fontSize: 10, color: Colors.textLight, marginTop: 2 },
});
