import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = 'primary',
}) {
  const inactive = loading || disabled;

  const gradients = {
    primary:   ['#1B6B3A', '#2D8653'],
    secondary: ['#2D8653', '#4CAF7A'],
    danger:    ['#DC2626', '#EF4444'],
  };

  const colors = gradients[variant] ?? gradients.primary;

  return (
    <TouchableOpacity
      style={[styles.wrap, inactive && styles.inactive, style]}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={inactive ? ['#9CA3AF', '#9CA3AF'] : colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.label}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1B6B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  inactive: {
    shadowOpacity: 0,
    elevation: 0,
  },
  gradient: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
