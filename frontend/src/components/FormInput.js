import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FormInput({
  label,
  value,
  onChangeText,
  placeholder = '',
  keyboardType = 'default',
  autoCapitalize = 'none',
  secureTextEntry = false,
  showToggle = false,
  onToggle,
  error,
  editable = true,
  maxLength,
  returnKeyType,
  onSubmitEditing,
  inputRef,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {!!label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.row,
          focused    && styles.rowFocused,
          !!error    && styles.rowError,
          !editable  && styles.rowDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A0AEC0"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
          editable={editable}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {showToggle && (
          <TouchableOpacity
            onPress={onToggle}
            style={styles.toggle}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={secureTextEntry ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={focused ? '#1B6B3A' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </View>

      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
  },
  rowFocused: {
    borderColor: '#1B6B3A',
    backgroundColor: '#FFFFFF',
  },
  rowError:    { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  rowDisabled: { backgroundColor: '#F3F4F6', opacity: 0.7 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  toggle:    { paddingLeft: 8 },
  errorRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 4 },
  errorText: { fontSize: 12, color: '#EF4444', flex: 1 },
});
