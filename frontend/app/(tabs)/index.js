import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';

import useAuthStore  from '../../src/store/authStore';
import useFarmStore  from '../../src/store/farmStore';
import * as farmService    from '../../src/api/farmService';
import * as engineService  from '../../src/api/engineService';
import * as weatherService from '../../src/api/weatherService';
import * as iotService     from '../../src/api/iotService';
import { Colors } from '../../src/constants/colors';

// ── Label maps ────────────────────────────────────────────────────────
const PRED_LABELS = {
  no_action:        'No action needed',
  irrigate_now:     'Irrigate immediately',
  irrigate_soon:    'Plan irrigation within 24 hours',
  partial_irrigate: 'Partial irrigation needed',
  apply_fungicide:  'Apply fungicide',
  apply_lime:       'Apply lime to raise pH',
  apply_sulfur:     'Apply sulfur to lower pH',
  apply_nitrogen:   'Apply nitrogen fertilizer',
  apply_phosphorus: 'Apply phosphorus fertilizer',
  apply_potassium:  'Apply potassium fertilizer',
  harvest_soon:     'Consider harvesting soon',
  frost_protection: 'Apply frost protection',
  monitor_blight:   'Monitor leaves for blight signs',
};

const WEATHER_EMOJI = {
  sunny:'☀️', clear:'☀️', cloudy:'☁️', overcast:'☁️',
  rain:'🌧️', rainy:'🌧️', drizzle:'🌦️', storm:'⛈️',
  thunderstorm:'⛈️', fog:'🌫️', mist:'🌫️', wind:'💨',
  hail:'🌨️', snow:'❄️', frost:'🥶',
};
const weatherEmoji = (c) => {
  if (!c) return '🌤️';
  const k = c.toLowerCase();
  for (const [key, val] of Object.entries(WEATHER_EMOJI)) {
    if (k.includes(key)) return val;
  }
  return '🌤️';
};

// ── Colour helpers ────────────────────────────────────────────────────
const healthColor = (s) =>
  s === 'healthy' ? Colors.success : s === 'warning' ? Colors.warning : s === 'critical' ? Colors.error : Colors.textSecondary;

const alertColor = (l) =>
  l === 'critical' ? Colors.alertCritical : l === 'warning' ? Colors.alertWarning : Colors.alertInfo;

const statusBg = (s) =>
  s === 'healthy' ? '#DCFCE7' : s === 'warning' ? '#FEF3C7' : s === 'critical' ? '#FEE2E2' : '#F3F4F6';

const moistureColor = (v) => {
  if (v == null) return Colors.textSecondary;
  if (v >= 25 && v <= 80) return Colors.success;
  if ((v >= 15 && v < 25) || (v > 80 && v <= 90)) return Colors.warning;
  return Colors.error;
};
const phColor = (v) => {
  if (v == null) return Colors.textSecondary;
  if (v >= 5.0 && v <= 6.5) return Colors.success;
  if ((v >= 4.5 && v < 5.0) || (v > 6.5 && v <= 7.5)) return Colors.warning;
  return Colors.error;
};
const tempColor = (v) => {
  if (v == null) return Colors.textSecondary;
  if (v >= 10 && v <= 25) return Colors.success;
  if (v > 25 && v <= 30) return Colors.warning;
  return Colors.error;
};
const humidityColor = (v) => {
  if (v == null) return Colors.textSecondary;
  if (v >= 50 && v <= 80) return Colors.success;
  if (v > 80 && v <= 90) return Colors.warning;
  return Colors.error;
};
const statusLabel = (color) =>
  color === Colors.success ? 'Good' : color === Colors.warning ? 'Watch' : color === Colors.error ? 'Alert' : '—';

// ── Skeleton ──────────────────────────────────────────────────────────
function SkeletonBlock({ style }) {
  const opacity = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.85, duration: 750, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.25, duration: 750, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[sk.block, style, { opacity }]} />;
}

function LoadingSkeleton() {
  return (
    <View style={sk.wrap}>
      <SkeletonBlock style={sk.tall} />
      <View style={sk.row}>
        <SkeletonBlock style={sk.half} />
        <SkeletonBlock style={sk.half} />
      </View>
      <SkeletonBlock style={sk.card} />
      <SkeletonBlock style={sk.card} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { activeFarm, activePlot, setActiveFarm, setActivePlot } = useFarmStore();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const [farms,       setFarms]       = useState([]);
  const [plots,       setPlots]       = useState([]);
  const [weather,     setWeather]     = useState(null);
  const [analysis,    setAnalysis]    = useState(null);
  const [alerts,      setAlerts]      = useState([]);
  const [reading,     setReading]     = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);

  // Stable fetchData — reads current store state via getState() to avoid
  // stale closures while keeping the callback dependency-free.
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError('');
    try {
      console.log('[Dashboard] Fetching data...');
      console.log('[Dashboard] Auth state:', useAuthStore.getState().isAuthenticated);

      const farmsData = await farmService.getFarms();
      console.log('[Dashboard] Farms response:', JSON.stringify(farmsData));

      setFarms(Array.isArray(farmsData) ? farmsData : []);

      if (!farmsData.length) { setLoading(false); setRefreshing(false); return; }

      // Always use freshest store state — not a stale closure
      const { activeFarm: af, activePlot: ap } = useFarmStore.getState();
      const farm = af ?? farmsData[0];
      setActiveFarm(farm);

      const plotsData = await farmService.getPlots(farm.id).catch(() => []);
      console.log('[Dashboard] Plots for farm', farm.id, ':', JSON.stringify(plotsData));
      setPlots(plotsData);

      if (!plotsData.length) {
        const wx = await weatherService.getWeather(farm.id).catch(() => null);
        setWeather(wx);
        setLoading(false); setRefreshing(false); return;
      }

      // Keep the stored activePlot only if it belongs to this farm's plots
      const validStored = ap && plotsData.find((p) => p.id === ap.id) ? ap : null;
      const plot = validStored ?? plotsData[0];
      setActivePlot(plot);

      const [wx, anal, alertsData, rdg] = await Promise.all([
        weatherService.getWeather(farm.id).catch(() => null),
        engineService.getLatestAnalysis(plot.id).catch(() => null),
        engineService.getAlerts().catch(() => []),
        iotService.getLatestReading(plot.id).catch(() => null),
      ]);

      setWeather(wx);
      setAnalysis(anal);
      // Filter alerts to only those belonging to the active plot
      const plotAlerts = Array.isArray(alertsData)
        ? alertsData.filter((a) => String(a.plot) === String(plot.id))
        : [];
      setAlerts(plotAlerts.slice(0, 3));
      setReading(rdg);
    } catch (error) {
      console.log('[Dashboard] Error:', error.message);
      console.log('[Dashboard] Error response:', JSON.stringify(error.response?.data));
      console.log('[Dashboard] Error status:', error.response?.status);
      setError('Failed to load dashboard. Press Retry to reload.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // intentionally empty — stable callback

  // Load only the plot-specific data — called when user switches plots
  const loadPlotData = useCallback(async (plot) => {
    if (!plot) return;
    setPlotLoading(true);
    setAnalysis(null);
    setReading(null);
    setAlerts([]);
    try {
      const [anal, alertsData, rdg] = await Promise.all([
        engineService.getLatestAnalysis(plot.id).catch(() => null),
        engineService.getAlerts().catch(() => []),
        iotService.getLatestReading(plot.id).catch(() => null),
      ]);
      setAnalysis(anal);
      const plotAlerts = Array.isArray(alertsData)
        ? alertsData.filter((a) => String(a.plot) === String(plot.id))
        : [];
      setAlerts(plotAlerts.slice(0, 3));
      setReading(rdg);
    } catch (_) {}
    finally { setPlotLoading(false); }
  }, []);

  // Switch to a different farm — fetches its plots, weather, and first plot data
  const loadFarmData = useCallback(async (farm) => {
    if (!farm) return;
    setActiveFarm(farm);
    setPlots([]);
    setActivePlot(null);
    setAnalysis(null);
    setReading(null);
    setAlerts([]);
    setWeather(null);
    setPlotLoading(true);
    try {
      const [plotsData, wx] = await Promise.all([
        farmService.getPlots(farm.id).catch(() => []),
        weatherService.getWeather(farm.id).catch(() => null),
      ]);
      setPlots(plotsData);
      setWeather(wx);
      if (plotsData.length > 0) {
        const first = plotsData[0];
        setActivePlot(first);
        const [anal, alertsData, rdg] = await Promise.all([
          engineService.getLatestAnalysis(first.id).catch(() => null),
          engineService.getAlerts().catch(() => []),
          iotService.getLatestReading(first.id).catch(() => null),
        ]);
        setAnalysis(anal);
        const plotAlerts = Array.isArray(alertsData)
          ? alertsData.filter((a) => String(a.plot) === String(first.id))
          : [];
        setAlerts(plotAlerts.slice(0, 3));
        setReading(rdg);
      }
    } catch (_) {}
    finally { setPlotLoading(false); }
  }, [setActiveFarm, setActivePlot]);

  // First mount → show skeleton; every subsequent focus → silent refresh
  const hasMounted = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      fetchData(false);
    } else {
      fetchData(true);
    }
  }, [fetchData]));

  const handleRunAnalysis = async () => {
    if (!activePlot || analysisRunning) return;
    setAnalysisRunning(true);
    try {
      await engineService.runAnalysis(activePlot.id);
      const anal = await engineService.getLatestAnalysis(activePlot.id).catch(() => null);
      setAnalysis(anal);
    } catch (_) {}
    finally { setAnalysisRunning(false); }
  };

  const firstName = user?.full_name?.split(' ')[0] ?? 'Farmer';
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = user?.full_name
    ?.split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('') ?? '?';

  // ── Header (reused across states) ───────────────────────────────────
  const Header = () => (
    <LinearGradient colors={['#0A2E18', '#1B6B3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.headerGreet}>{greeting}, {firstName} 👋</Text>
        <Text style={s.headerSub} numberOfLines={1}>
          {activeFarm?.name
            ? `📍 ${activeFarm.name}  ·  ${today}`
            : today}
        </Text>
      </View>
      <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={s.avatar}>
        <Text style={s.avatarText}>{initials}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <LoadingSkeleton />
      </SafeAreaView>
    );
  }

  if (error && !farms.length) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <View style={s.centered}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorMsg}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => fetchData()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[Colors.primary]} tintColor={Colors.primary} />
        }
      >
        {/* ── No farm ─────────────────────────────────────────────── */}
        {!farms.length && (
          <OnboardCard
            emoji="🌾"
            title="Set up your first farm"
            body="Add a farm to start monitoring soil conditions, weather, and crop health with AI."
            btnLabel="Add Farm"
            onPress={() => router.push('/(tabs)/farms')}
          />
        )}

        {/* ── Farm exists but no plot ──────────────────────────────── */}
        {!!farms.length && !activePlot && (
          <OnboardCard
            emoji="🗺️"
            title={`Add a plot to ${activeFarm?.name ?? 'your farm'}`}
            body="Plots represent individual growing areas. Add one to see health scores and AI recommendations."
            btnLabel="Add Plot"
            onPress={() => router.push('/(tabs)/farms')}
          />
        )}

        {/* ── Farm + Plot switcher ─────────────────────────────────── */}
        {(farms.length > 1 || plots.length > 1) && (
          <View style={s.switcherCard}>

            {/* Farm row — only when 2+ farms */}
            {farms.length > 1 && (
              <>
                <Text style={s.switcherLabel}>FARM</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.switcherRow}
                >
                  {farms.map((farm) => {
                    const active = activeFarm?.id === farm.id;
                    return (
                      <TouchableOpacity
                        key={farm.id}
                        style={[s.farmChip, active && s.farmChipActive]}
                        onPress={() => { if (!active) loadFarmData(farm); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.farmChipIcon]}>🌾</Text>
                        <Text style={[s.farmChipText, active && s.farmChipTextActive]}
                          numberOfLines={1}>
                          {farm.name}
                        </Text>
                        {active && <View style={s.farmChipTick}><Text style={s.farmChipTickText}>✓</Text></View>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Divider when both selectors are visible */}
            {farms.length > 1 && plots.length > 1 && <View style={s.switcherDivider} />}

            {/* Plot row — only when 2+ plots for the active farm */}
            {plots.length > 1 && (
              <>
                <Text style={s.switcherLabel}>PLOT</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.switcherRow}
                >
                  {plots.map((plot) => {
                    const active = activePlot?.id === plot.id;
                    return (
                      <TouchableOpacity
                        key={plot.id}
                        style={[s.plotChip, active && s.plotChipActive]}
                        onPress={async () => {
                          if (active) return;
                          setActivePlot(plot);
                          await loadPlotData(plot);
                        }}
                        activeOpacity={0.75}
                      >
                        {active && <View style={s.plotChipDot} />}
                        <Text style={[s.plotChipText, active && s.plotChipTextActive]}>
                          {plot.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        )}

        {/* ── Loading indicator when switching farm or plot ─────────── */}
        {plotLoading && (
          <View style={s.plotLoadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={s.plotLoadingText}>Loading…</Text>
          </View>
        )}

        {/* ── Health score ─────────────────────────────────────────── */}
        {!!activePlot && !plotLoading && (
          <HealthCard
            plot={activePlot}
            analysis={analysis}
            onRunAnalysis={handleRunAnalysis}
            analysisRunning={analysisRunning}
          />
        )}

        {/* ── Soil conditions ──────────────────────────────────────── */}
        {!!activePlot && !plotLoading && reading && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Soil Conditions</Text>
            <View style={s.soilGrid}>
              <SoilCell icon="💧" label="Moisture" value={reading.moisture != null ? `${reading.moisture}%` : '—'} color={moistureColor(reading.moisture)} />
              <SoilCell icon="🧪" label="pH Level" value={reading.ph != null ? Number(reading.ph).toFixed(1) : '—'} color={phColor(reading.ph)} />
              <SoilCell icon="🌡️" label="Temp" value={reading.temperature != null ? `${reading.temperature}°C` : '—'} color={tempColor(reading.temperature)} />
              <SoilCell icon="💨" label="Humidity" value={reading.humidity != null ? `${reading.humidity}%` : '—'} color={humidityColor(reading.humidity)} />
            </View>
          </View>
        )}
        {!!activePlot && !plotLoading && !reading && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Soil Conditions</Text>
            <EmptyHint text="No sensor data yet. Add a reading from the Farms tab." />
          </View>
        )}

        {/* ── Weather ──────────────────────────────────────────────── */}
        {!!activeFarm && (
          <WeatherCard weather={weather} />
        )}

        {/* ── AI recommendation ────────────────────────────────────── */}
        {!!activePlot && !plotLoading && !!analysis?.xgboost_prediction && (
          <AICard analysis={analysis} />
        )}

        {/* ── Quick actions ────────────────────────────────────────── */}
        {!!activePlot && (
          <View style={s.actionsGrid}>
            <ActionBtn
              icon="🔬" label={analysisRunning ? 'Running…' : 'Run Analysis'}
              bg="#EEF2FF" border="#C7D2FE"
              onPress={handleRunAnalysis} disabled={analysisRunning}
            />
            <ActionBtn
              icon="📷" label="Scan Crop"
              bg="#FFF7ED" border="#FED7AA"
              onPress={() => router.push(`/farm/${activeFarm?.id}/plot/${activePlot?.id}/scan`)}
            />
            <ActionBtn
              icon="🌾" label="My Farms"
              bg="#F0FDF4" border="#BBF7D0"
              onPress={() => router.push('/(tabs)/farms')}
            />
            <ActionBtn
              icon="📈" label="Market"
              bg="#FDF4FF" border="#E9D5FF"
              onPress={() => router.push('/(tabs)/market')}
            />
          </View>
        )}

        {/* ── Active alerts ────────────────────────────────────────── */}
        {!!activePlot && !plotLoading && alerts.length > 0 && (
          <View style={s.card}>
            <View style={s.rowBetween}>
              <Text style={s.sectionTitle}>Active Alerts</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/alerts')}>
                <Text style={s.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {alerts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={s.alertRow}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/alert/[alertId]', params: { alertId: a.id, alert: JSON.stringify(a) } })}
              >
                <View style={[s.alertBar, { backgroundColor: alertColor(a.level) }]} />
                <View style={s.alertBody}>
                  <Text style={s.alertTitle} numberOfLines={1}>{a.title}</Text>
                  <Text style={s.alertMsg} numberOfLines={1}>{a.message}</Text>
                </View>
                <Text style={[s.alertBadge, { color: alertColor(a.level) }]}>
                  {a.level?.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function OnboardCard({ emoji, title, body, btnLabel, onPress }) {
  return (
    <View style={ob.card}>
      <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={ob.iconWrap}>
        <Text style={ob.emoji}>{emoji}</Text>
      </LinearGradient>
      <Text style={ob.title}>{title}</Text>
      <Text style={ob.body}>{body}</Text>
      <TouchableOpacity style={ob.btn} onPress={onPress} activeOpacity={0.85}>
        <LinearGradient
          colors={['#1B6B3A', '#2D8653']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={ob.btnGradient}
        >
          <Text style={ob.btnText}>{btnLabel}  →</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function HealthCard({ plot, analysis, onRunAnalysis, analysisRunning }) {
  const score  = analysis?.health_score ?? null;
  const status = analysis?.health_status ?? null;
  const hColor = healthColor(status);

  return (
    <View style={hc.card}>
      {/* Top: label + plot name + score ring */}
      <View style={hc.topRow}>
        <View style={hc.left}>
          <Text style={hc.plotLabel}>PLOT HEALTH</Text>
          <Text style={hc.plotName} numberOfLines={1}>{plot.name}</Text>

          {/* Status pill row */}
          <View style={hc.bottomRow}>
            {status ? (
              <View style={[hc.statusPill, { backgroundColor: statusBg(status) }]}>
                <View style={[hc.statusDot, { backgroundColor: hColor }]} />
                <Text style={[hc.statusText, { color: hColor }]}>{status.toUpperCase()}</Text>
              </View>
            ) : null}
            {analysis?.growth_stage ? (
              <Text style={hc.stageText}>
                🌱 {analysis.growth_stage.replace(/_/g, ' ')}
              </Text>
            ) : !analysis ? (
              <Text style={hc.noAnalysis}>No analysis yet</Text>
            ) : null}
          </View>
        </View>

        {/* Circular score ring */}
        {score != null ? (
          <View style={[hc.ring, { borderColor: hColor, backgroundColor: hColor + '12' }]}>
            <Text style={[hc.ringNum, { color: hColor }]}>{score}</Text>
            <Text style={[hc.ringOf,  { color: hColor }]}>/100</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={hc.runBtn}
            onPress={onRunAnalysis}
            disabled={analysisRunning}
            activeOpacity={0.8}
          >
            <Text style={hc.runBtnIcon}>🔬</Text>
            <Text style={hc.runBtnText}>
              {analysisRunning ? 'Running…' : 'Analyse'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Score progress bar */}
      <View style={hc.barBg}>
        <View style={[hc.barFill, {
          width: score != null ? `${score}%` : '0%',
          backgroundColor: hColor,
        }]} />
      </View>
      <View style={hc.barLabels}>
        <Text style={hc.barLabelL}>0</Text>
        <Text style={hc.barLabelR}>100</Text>
      </View>
    </View>
  );
}

function SoilCell({ icon, label, value, color }) {
  const sl = statusLabel(color);
  return (
    <View style={sc.cell}>
      <Text style={sc.icon}>{icon}</Text>
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
      {/* Colored bottom status strip */}
      <View style={[sc.strip, { backgroundColor: color }]} />
    </View>
  );
}

function WeatherCard({ weather }) {
  if (!weather) {
    return (
      <View style={s.card}>
        <Text style={s.sectionTitle}>🌤️  Weather</Text>
        <EmptyHint text="Weather data unavailable." />
      </View>
    );
  }
  return (
    <View style={wc.card}>
      {/* Hero row */}
      <View style={wc.hero}>
        <Text style={wc.heroEmoji}>{weatherEmoji(weather.condition)}</Text>
        <View style={wc.heroRight}>
          <Text style={wc.heroTemp}>
            {weather.temperature_current != null ? `${weather.temperature_current}°C` : '—'}
          </Text>
          <Text style={wc.heroCondition}>{weather.condition ?? '—'}</Text>
          <Text style={wc.heroDate}>{new Date().toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'short' })}</Text>
        </View>
      </View>

      {/* Stats strip */}
      <View style={wc.strip}>
        <WeatherStat icon="💧" label="Humidity"
          value={weather.humidity != null ? `${weather.humidity}%` : '—'} />
        <View style={wc.stripDivider} />
        <WeatherStat icon="💨" label="Wind"
          value={weather.wind_speed != null ? `${weather.wind_speed} km/h` : '—'} />
        <View style={wc.stripDivider} />
        <WeatherStat icon="🌧️" label="Rain 24h"
          value={weather.rainfall_probability_24h != null
            ? `${Math.round(weather.rainfall_probability_24h * 100)}%` : '—'} />
      </View>

      {weather.frost_probability > 0.3 && (
        <View style={wc.frost}>
          <Text style={wc.frostText}>
            🥶  Frost risk {Math.round(weather.frost_probability * 100)}% — protect crops tonight
          </Text>
        </View>
      )}
    </View>
  );
}

function WeatherStat({ icon, label, value }) {
  return (
    <View style={wc.stat}>
      <Text style={wc.statIcon}>{icon}</Text>
      <Text style={wc.statVal}>{value}</Text>
      <Text style={wc.statLabel}>{label}</Text>
    </View>
  );
}

function AICard({ analysis }) {
  const conf = Math.round((analysis.xgboost_confidence ?? 0) * 100);
  return (
    <LinearGradient
      colors={['#0A2E18', '#1B6B3A']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={ai.card}
    >
      {/* Header row */}
      <View style={ai.header}>
        <View style={ai.badge}>
          <Text style={ai.badgeText}>🤖 AI</Text>
        </View>
        <Text style={ai.tag}>RECOMMENDATION</Text>
      </View>

      {/* Action */}
      <Text style={ai.action}>
        {PRED_LABELS[analysis.xgboost_prediction] ?? analysis.xgboost_prediction}
      </Text>

      {/* Confidence bar */}
      {analysis.xgboost_confidence != null && (
        <View style={ai.confWrap}>
          <View style={ai.confBarBg}>
            <View style={[ai.confBarFill, { width: `${conf}%` }]} />
          </View>
          <Text style={ai.confPct}>{conf}%</Text>
        </View>
      )}
    </LinearGradient>
  );
}

function ActionBtn({ icon, label, bg, border, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[ac.btn, { backgroundColor: bg, borderColor: border }, disabled && ac.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.72}
    >
      <Text style={ac.icon}>{icon}</Text>
      <Text style={ac.label}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyHint({ text }) {
  return <Text style={s.emptyHint}>{text}</Text>;
}

// ── Styles ────────────────────────────────────────────────────────────
const BG = '#F1F5F2';   // off-white green tint — better outdoor readability

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 14 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerGreet: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.1 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: '500' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.38)',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  // Generic white card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#374151',
    marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.6,
  },

  soilGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seeAll:     { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  alertRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 8, backgroundColor: '#F8FFFE',
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E8F5F0',
  },
  alertBar:   { width: 5, alignSelf: 'stretch' },
  alertBody:  { flex: 1, paddingHorizontal: 12, paddingVertical: 11 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  alertMsg:   { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 16 },
  alertBadge: { fontSize: 9, fontWeight: '800', paddingRight: 12, letterSpacing: 0.5 },

  // ── Farm + Plot switcher card ──────────────────────────────────────
  switcherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  switcherLabel: {
    fontSize: 10, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 8, paddingHorizontal: 2,
  },
  switcherRow:     { gap: 8, paddingBottom: 2 },
  switcherDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },

  // Farm chips — parent level (dark green)
  farmChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 22, borderWidth: 1.5, borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB', gap: 6, maxWidth: 180,
  },
  farmChipActive:     { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  farmChipIcon:       { fontSize: 14 },
  farmChipText:       { fontSize: 14, fontWeight: '600', color: '#374151', flexShrink: 1 },
  farmChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  farmChipTick: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  farmChipTickText: { fontSize: 10, color: '#FFFFFF', fontWeight: '800' },

  // Plot chips — child level (medium green)
  plotSelectorWrap: { marginBottom: 12 },
  plotSelector:     { paddingHorizontal: 14, gap: 8 },
  plotChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB', gap: 6,
  },
  plotChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  plotChipDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#74C69D' },
  plotChipText:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  plotChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  plotLoadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 32,
  },
  plotLoadingText: { fontSize: 13, color: Colors.textSecondary },

  emptyHint: {
    fontSize: 13, color: '#9CA3AF', fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 10,
  },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorMsg:  { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  retryBtn:  { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

const ob = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, overflow: 'hidden',
  },
  emoji:  { fontSize: 44 },
  title:  { fontSize: 21, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  body:   { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn:    { borderRadius: 14, overflow: 'hidden', width: '100%' },
  btnGradient: { paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.4 },
});

const hc = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  left:      { flex: 1, marginRight: 14 },
  plotLabel: {
    fontSize: 10, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5,
  },
  plotName: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 12 },

  // Circular score ring — border creates the ring, content is the number
  ring: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  ringNum: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  ringOf:  { fontSize: 12, fontWeight: '700' },

  runBtn: {
    width: 88, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  runBtnIcon: { fontSize: 22 },
  runBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Progress bar
  barBg: {
    height: 10, backgroundColor: '#F3F4F6',
    borderRadius: 5, overflow: 'hidden', marginBottom: 6,
  },
  barFill: { height: 10, borderRadius: 5 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  barLabelL: { fontSize: 10, color: '#D1D5DB', fontWeight: '600' },
  barLabelR: { fontSize: 10, color: '#D1D5DB', fontWeight: '600' },

  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 5,
  },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  stageText:  { fontSize: 13, color: '#6B7280', fontWeight: '500', textTransform: 'capitalize' },
  noAnalysis: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
});

const sc = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  icon:  { fontSize: 26, marginBottom: 6 },
  value: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  label: {
    fontSize: 11, color: '#9CA3AF', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  // Colored bottom accent strip
  strip: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
  },
});

const wc = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  // Hero: big emoji left, temp+condition right
  hero: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  heroEmoji: { fontSize: 64, marginRight: 20 },
  heroRight: { flex: 1 },
  heroTemp:      { fontSize: 46, fontWeight: '800', color: '#111827', lineHeight: 50 },
  heroCondition: { fontSize: 15, color: '#6B7280', textTransform: 'capitalize', marginTop: 2 },
  heroDate:      { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  // Stats strip
  strip: {
    flexDirection: 'row',
    backgroundColor: BG,
    borderRadius: 14,
    paddingVertical: 14,
  },
  stripDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 2 },
  stat:     { flex: 1, alignItems: 'center', gap: 3 },
  statIcon: { fontSize: 20 },
  statVal:  { fontSize: 15, fontWeight: '800', color: '#111827' },
  statLabel:{ fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  frost: {
    marginTop: 12, backgroundColor: '#EFF6FF',
    borderRadius: 12, padding: 13,
    borderLeftWidth: 4, borderLeftColor: '#3B82F6',
  },
  frostText: { fontSize: 13, color: '#1D4ED8', fontWeight: '600' },
});

const ai = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 22,
    marginBottom: 12,
    shadowColor: '#0A2E18',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  tag:    { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  action: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 30, marginBottom: 18 },
  confWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confBarBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
  confBarFill: { height: 6, backgroundColor: '#74C69D', borderRadius: 3 },
  confPct: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '800', minWidth: 36, textAlign: 'right' },

  // keep the old fields so existing references compile (unused)
  top:     {},
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  icon:     { fontSize: 20 },
  // legacy keys referenced by old AICard code — safe to keep empty
  confRow:  {},
  confLabel:{},
});

const ac = StyleSheet.create({
  btn: {
    width: '48%',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 6,
  },
  disabled: { opacity: 0.4 },
  icon:  { fontSize: 30 },
  label: { fontSize: 12, color: '#374151', fontWeight: '700', textAlign: 'center', lineHeight: 17 },
});

const sk = StyleSheet.create({
  wrap:  { padding: 14 },
  block: { backgroundColor: '#D9E8DD', borderRadius: 16 },
  tall:  { height: 140, marginBottom: 12 },
  card:  { height: 100, marginBottom: 12 },
  row:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
  half:  { flex: 1, height: 120, borderRadius: 16 },
});
