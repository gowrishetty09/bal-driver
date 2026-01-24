import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { useTheme, ThemeColors } from '../../context/ThemeContext';
import { typography } from '../../theme/typography';
import { SupportStackParamList } from '../../types/navigation';
import { useSupportStore } from '../../store/supportStore';
import { getErrorMessage } from '../../utils/errors';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const getStatusColor = (status: string, colors: ThemeColors): string => {
  const statusColors: Record<string, string> = {
    OPEN: colors.primary,
    IN_PROGRESS: colors.brandNavy,
    RESOLVED: colors.success,
    CLOSED: colors.muted,
  };
  return statusColors[status] ?? colors.brandNavy;
};

type Props = NativeStackScreenProps<SupportStackParamList, 'SupportTicketDetails'>;

export const SupportTicketDetailsScreen: React.FC<Props> = ({ route }) => {
  const { ticketId } = route.params;
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { selectedTicket, isLoadingTicket, selectTicket, sendMessage } = useSupportStore();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadTicket = useCallback(async () => {
    try {
      await selectTicket(ticketId);
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load ticket');
      showErrorToast('Support', message);
    }
  }, [selectTicket, ticketId]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const handleSend = async () => {
    if (!message.trim()) {
      return;
    }
    setSending(true);
    try {
      await sendMessage(ticketId, message.trim());
      setMessage('');
      showSuccessToast('Reply sent');
      listRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      const friendly = getErrorMessage(error, 'Unable to send message');
      showErrorToast('Support', friendly);
    } finally {
      setSending(false);
    }
  };

  if (isLoadingTicket && !selectedTicket) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!selectedTicket) {
    return (
      <Screen contentContainerStyle={styles.loaderContainer}>
        <Text style={styles.errorText}>Ticket not found.</Text>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen>
        <View style={styles.header}>
          <Text style={styles.subject}>{selectedTicket.subject}</Text>
          <View
            style={[styles.statusPill, { backgroundColor: getStatusColor(selectedTicket.status, colors) }]}
          >
            <Text style={styles.statusLabel}>{selectedTicket.status}</Text>
          </View>
        </View>
        <Text style={styles.metaText}>{`Category ${selectedTicket.category.replace('_', ' ')} • Priority ${selectedTicket.priority}`}</Text>
        <Text style={styles.description}>{selectedTicket.description}</Text>
        <FlatList
          ref={listRef}
          data={selectedTicket.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.thread}
          renderItem={({ item }) => {
            const isDriver = item.authorType === 'DRIVER';
            const messageText = item.body ?? item.message ?? '';
            return (
              <View style={[styles.messageBubble, isDriver ? styles.driverBubble : styles.dispatchBubble]}>
                <Text style={[styles.messageAuthor, isDriver ? styles.driverText : styles.dispatchText]}>
                  {item.authorType}
                </Text>
                <Text style={[styles.messageBody, isDriver ? styles.driverText : styles.dispatchText]}>{messageText}</Text>
                <Text style={[styles.messageTimestamp, isDriver ? styles.driverText : styles.dispatchText]}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            placeholder="Type a reply"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!message.trim() || sending) && styles.sendDisabled]}
            disabled={!message.trim() || sending}
            onPress={handleSend}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendLabel}>Send</Text>}
          </Pressable>
        </View>
        </Screen>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.body,
  },
  header: {
    padding: 16,
  },
  subject: {
    fontSize: typography.heading,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusLabel: {
    color: colors.textInverse,
    fontSize: typography.caption,
  },
  metaText: {
    paddingHorizontal: 16,
    color: colors.muted,
    fontSize: typography.caption,
  },
  description: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: typography.body,
    color: colors.text,
  },
  thread: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  driverBubble: {
    backgroundColor: colors.brandNavy,
    alignSelf: 'flex-end',
  },
  dispatchBubble: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  driverText: {
    color: colors.brandGold,
  },
  dispatchText: {
    color: colors.text,
  },
  messageAuthor: {
    fontSize: typography.caption,
    fontFamily: typography.fontFamilyMedium,
  },
  messageBody: {
    marginTop: 4,
    fontSize: typography.body,
  },
  messageTimestamp: {
    marginTop: 4,
    fontSize: typography.caption,
    opacity: 0.8,
  },
  composer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.text,
  },
  sendButton: {
    marginTop: 12,
    backgroundColor: colors.brandNavy,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    color: colors.brandGold,
    fontFamily: typography.fontFamilyMedium,
  },
});
