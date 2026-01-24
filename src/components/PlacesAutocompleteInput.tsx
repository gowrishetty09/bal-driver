import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fetchPlacePredictions, PlacePrediction } from '../services/googlePlaces';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { typography } from '../theme/typography';

export type PlacesAutocompleteInputProps = {
  placeholder?: string;
  initialValue?: string;
  onSelect: (place: PlacePrediction) => void;
};

export const PlacesAutocompleteInput: React.FC<PlacesAutocompleteInputProps> = ({
  placeholder = 'Search location',
  initialValue = '',
  onSelect,
}) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (!touched || !query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const predictions = await fetchPlacePredictions(query.trim());
        if (isCurrent) {
          setResults(predictions);
        }
      } catch (error) {
        console.log('Places autocomplete failed', error);
        if (isCurrent) {
          setResults([]);
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [query, touched]);

  const handleSelect = (prediction: PlacePrediction) => {
    onSelect(prediction);
    setResults([]);
    setQuery(prediction.description);
  };

  const showDropdown = useMemo(() => results.length > 0 || loading, [results.length, loading]);

  return (
    <View style={styles.container}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={query}
        onChangeText={(text) => {
          setTouched(true);
          setQuery(text);
        }}
      />
      {showDropdown && (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Searching…</Text>
            </View>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="always"
              data={results}
              keyExtractor={(item) => item.placeId}
              renderItem={({ item }) => (
                <Pressable style={styles.resultRow} onPress={() => handleSelect(item)}>
                  <Text style={styles.resultText}>{item.description}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No suggestions</Text>}
            />
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    maxHeight: 220,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultText: {
    color: colors.text,
    fontSize: typography.body,
  },
  emptyText: {
    padding: 12,
    textAlign: 'center',
    color: colors.muted,
    fontSize: typography.caption,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  loadingText: {
    fontSize: typography.body,
    color: colors.muted,
  },
});
