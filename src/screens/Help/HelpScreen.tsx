import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { useTheme, ThemeColors } from '../../context/ThemeContext';

interface HelpSection {
  key: string;
  title: string;
  icon: string;
  content: string[];
}

const helpSections: HelpSection[] = [
  {
    key: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket-outline',
    content: [
      '1. Make sure you are logged in with your driver credentials',
      '2. Enable location services when prompted - this is required for dispatch',
      '3. Go to your Profile and set yourself as "Online" to receive jobs',
      '4. You will receive push notifications for new job assignments',
    ],
  },
  {
    key: 'accepting-jobs',
    title: 'Accepting Jobs',
    icon: 'checkmark-circle-outline',
    content: [
      '• When a new job is assigned, you will receive a notification',
      '• Open the app and view the job details',
      '• Review pickup location, drop location, and customer info',
      '• Tap "Accept" to confirm you will complete the job',
      '• If you cannot take the job, contact dispatch immediately',
    ],
  },
  {
    key: 'job-workflow',
    title: 'Job Workflow',
    icon: 'git-branch-outline',
    content: [
      '1. ASSIGNED - Job is assigned to you',
      '2. EN ROUTE - Tap when you start heading to pickup',
      '3. ARRIVED - Tap when you reach the pickup location',
      '4. PICKED UP - Tap when customer is in the vehicle',
      '5. COMPLETED - Tap when you reach the destination',
      '',
      'Important: Update status at each step so dispatch and customer can track progress.',
    ],
  },
  {
    key: 'navigation',
    title: 'Navigation',
    icon: 'navigate-outline',
    content: [
      '• Tap the navigation button to open Google Maps/Waze',
      '• The pickup and drop addresses are pre-filled',
      '• For airport pickups, note the terminal and meeting point',
      '• If address is unclear, call the customer or dispatch',
    ],
  },
  {
    key: 'customer-contact',
    title: 'Contacting Customers',
    icon: 'call-outline',
    content: [
      '• Use the call button in job details to call the customer',
      '• Call when you are close to pickup (5 minutes away)',
      '• Call if you cannot find the exact location',
      '• Be professional and courteous on all calls',
      '• For airport arrivals, coordinate meeting point',
    ],
  },
  {
    key: 'expenses',
    title: 'Submitting Expenses',
    icon: 'receipt-outline',
    content: [
      '• Go to Expenses from the menu',
      '• Tap "Add Expense" to submit a new expense',
      '• Select expense type (Fuel, Toll, Parking, Maintenance)',
      '• Enter amount and take a photo of the receipt',
      '• Submit for approval - you will be notified when approved',
    ],
  },
  {
    key: 'earnings',
    title: 'Viewing Earnings',
    icon: 'wallet-outline',
    content: [
      '• View your completed jobs in the History tab',
      '• Each job shows the fare amount',
      '• Commission is calculated automatically',
      '• Settlements are processed periodically',
      '• Contact admin for any payment queries',
    ],
  },
  {
    key: 'going-offline',
    title: 'Going Offline',
    icon: 'power-outline',
    content: [
      '• Go to Profile and toggle your status to "Offline"',
      '• You will not receive new job assignments when offline',
      '• Complete any active jobs before going offline',
      '• Use this during breaks or at end of shift',
    ],
  },
  {
    key: 'support',
    title: 'Getting Support',
    icon: 'help-circle-outline',
    content: [
      '• For urgent issues, call dispatch directly',
      '• Use the Support page to create a ticket for non-urgent issues',
      '• Provide booking ID when reporting job-related issues',
      '• Include screenshots if reporting app problems',
    ],
  },
  {
    key: 'tips',
    title: 'Tips for Success',
    icon: 'bulb-outline',
    content: [
      '✓ Keep your phone charged and data active',
      '✓ Arrive 5-10 minutes early for pickups',
      '✓ Keep your vehicle clean and presentable',
      '✓ Be polite and professional with all customers',
      '✓ Update job status promptly',
      '✓ Report any incidents immediately to dispatch',
      '✓ Check customer luggage before completing drop-off',
    ],
  },
];

const faqItems = [
  {
    question: 'What if the customer is not at the pickup location?',
    answer:
      'Wait for 10 minutes and try calling the customer. If no response, contact dispatch. Do not leave without dispatch approval - they will guide you on next steps.',
  },
  {
    question: 'How do I cancel a job?',
    answer:
      'You cannot cancel a job directly. Contact dispatch immediately if you are unable to complete an assigned job. They will reassign it to another driver.',
  },
  {
    question: 'What if my app is not receiving notifications?',
    answer:
      'Check that notifications are enabled in phone settings. Make sure you have a stable internet connection. Try logging out and back in. If issue persists, contact support.',
  },
  {
    question: 'How are my earnings calculated?',
    answer:
      'Earnings = Fare Amount - Commission. Your commission rate is set by admin. You can view the breakdown in job details after completion.',
  },
  {
    question: 'What should I do in case of an accident?',
    answer:
      'Ensure everyone is safe first. Call emergency services if needed. Take photos of the scene. Contact dispatch immediately. Do not leave the scene until authorities arrive if required.',
  },
];

export const HelpScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleSection = (key: string) => {
    setExpandedSection(expandedSection === key ? null : key);
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const callSupport = () => {
    Linking.openURL('tel:+60312345678');
  };

  return (
    <Screen scrollable edges={['bottom']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="help-circle" size={40} color={colors.primary} />
          <Text style={styles.headerTitle}>Driver Help Center</Text>
          <Text style={styles.headerSubtitle}>
            Everything you need to know about using the driver app
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={callSupport}>
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Call Dispatch</Text>
          </TouchableOpacity>
        </View>

        {/* Help Sections */}
        <View style={styles.sectionsContainer}>
          <Text style={styles.sectionHeader}>How-To Guides</Text>
          {helpSections.map((section) => (
            <View key={section.key} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionTitle}
                onPress={() => toggleSection(section.key)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionTitleLeft}>
                  <Ionicons
                    name={section.icon as any}
                    size={22}
                    color={colors.primary}
                    style={styles.sectionIcon}
                  />
                  <Text style={styles.sectionTitleText}>{section.title}</Text>
                </View>
                <Ionicons
                  name={expandedSection === section.key ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.muted}
                />
              </TouchableOpacity>
              {expandedSection === section.key && (
                <View style={styles.sectionContent}>
                  {section.content.map((line, index) => (
                    <Text key={index} style={styles.contentLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* FAQ */}
        <View style={styles.sectionsContainer}>
          <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
          {faqItems.map((faq, index) => (
            <View key={index} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionTitle}
                onPress={() => toggleFaq(index)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sectionTitleText, styles.faqQuestion]}>
                  {faq.question}
                </Text>
                <Ionicons
                  name={expandedFaq === index ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.muted}
                />
              </TouchableOpacity>
              {expandedFaq === index && (
                <View style={styles.sectionContent}>
                  <Text style={styles.contentLine}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Contact Support */}
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Need More Help?</Text>
          <Text style={styles.contactText}>
            Contact dispatch for urgent issues or use the Support page to create a ticket.
          </Text>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
            <Text style={styles.contactInfo}>+60 3-1234 5678</Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
            <Text style={styles.contactInfo}>driver-support@bestaerolimo.com</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </Screen>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  sectionsContainer: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  faqQuestion: {
    paddingRight: 8,
  },
  sectionContent: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contentLine: {
    fontSize: 16,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 4,
  },
  contactCard: {
    margin: 16,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 16,
    color: colors.muted,
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  contactInfo: {
    fontSize: 16,
    color: colors.text,
  },
  bottomPadding: {
    height: 40,
  },
});

export default HelpScreen;
