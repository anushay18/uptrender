

import { useTheme } from '@/context/ThemeContext';
import { authService } from '@/services';
import { API_CONFIG } from '@/services/config';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// LazyImage component for fade-in with placeholder
function LazyImage({ uri, style, initials }: { uri?: string | null; style?: any; initials?: string }) {
  const [loaded, setLoaded] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!uri) {
      setLoaded(false);
      opacity.setValue(0);
    }
  }, [uri]);

  const onLoad = () => {
    setLoaded(true);
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  // If no URI, show initials avatar immediately without loading indicator
  if (!uri) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#5B7FFF' }]}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 24 }}>{initials || 'U'}</Text>
      </View>
    );
  }

  return (
    <View style={[{ justifyContent: 'center', alignItems: 'center' }, style]}>
      {!loaded && (
        <View style={[StyleSheet.flatten(style), { position: 'absolute', justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color="#5B7FFF" />
        </View>
      )}
      <Animated.Image source={{ uri }} onLoad={onLoad} style={[style, { opacity }]} />
    </View>
  );
}

interface UserData {
  name: string;
  username: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  password: string;
  status: string;
  currency: string;
  referralCode: string;
  referralLink: string;
  referredBy: string;
  joinedBy: string;
  clientId: string;
  clientType: string;
}

export default function MyAccountScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [userData, setUserData] = useState<UserData>({
    name: '',
    username: '',
    email: '',
    phone: '',
    emailVerified: false,
    phoneVerified: false,
    password: '••••••••',
    status: 'Active',
    currency: 'INR',
    referralCode: '-',
    referralLink: '-',
    referredBy: '-',
    joinedBy: '-',
    clientId: '-',
    clientType: 'Individual',
  });

  // Fetch user profile from API
  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await authService.getProfile();
      if (response.success && response.data) {
        const user = response.data;
        setUserData({
          name: user.name || '',
          username: user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          emailVerified: user.emailVerified === 'Yes',
          phoneVerified: user.phoneVerified === 'Yes',
          password: '••••••••',
          status: user.status || 'Active',
          currency: user.currency || 'INR',
          referralCode: user.referralCode || '-',
          referralLink: user.referralLink || '-',
          referredBy: user.referredBy || '-',
          joinedBy: '-',
          clientId: user.clientId || '-',
          clientType: user.clientType || 'Individual',
        });
        if (user.avatar) {
          const avatarUrl = user.avatar.startsWith('http') 
            ? user.avatar 
            : `${API_CONFIG.BASE_URL}${user.avatar}`;
          setProfileImage(avatarUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Form states
  const [formData, setFormData] = useState({...userData});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [panDocument, setPanDocument] = useState<string | null>(null);
  const [aadhaarDocument, setAadhaarDocument] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const pickDocument = async (type: 'pan' | 'aadhaar') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      if (type === 'pan') {
        setPanDocument(result.assets[0].uri);
      } else {
        setAadhaarDocument(result.assets[0].uri);
      }
    }
  };

  const handleEditSection = (section: string) => {
    setFormData({...userData});
    setEditingSection(section);
  };

  const handleSaveBasicInfo = async () => {
    setIsSaving(true);
    try {
      const response = await authService.updateProfile({
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        status: formData.status as 'Active' | 'Inactive',
        currency: formData.currency,
      });
      
      if (response.success) {
        setUserData({
          ...userData,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
          currency: formData.currency,
        });
        setEditingSection(null);
        Alert.alert('Success', 'Basic information updated successfully');
      } else {
        Alert.alert('Error', response.error || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await authService.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setEditingSection(null);
        Alert.alert('Success', 'Password changed successfully');
      } else {
        Alert.alert('Error', response.error || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveReferral = () => {
    setUserData({
      ...userData,
      referralCode: formData.referralCode,
      referralLink: formData.referralLink,
      referredBy: formData.referredBy,
      joinedBy: formData.joinedBy,
      clientId: formData.clientId,
      clientType: formData.clientType,
    });
    setEditingSection(null);
    Alert.alert('Success', 'Referral information updated successfully');
  };

  const handleUploadKYC = () => {
    if (!panDocument && !aadhaarDocument) {
      Alert.alert('Error', 'Please select at least one document');
      return;
    }
    Alert.alert('Success', 'KYC documents uploaded successfully');
    setEditingSection(null);
  };

  const closeModal = () => {
    setEditingSection(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCopy = async (text: string, label: string) => {
    if (text && text !== '-') {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', `${label} copied to clipboard`);
    } else {
      Alert.alert('Nothing to copy', `No ${label} available`);
    }
  };

  const theme = {
    bg: isDark ? '#0a0a0f' : '#f8f9fc',
    cardBg: isDark ? 'rgba(30,30,58,0.8)' : '#fff',
    text: isDark ? '#fff' : '#1f2937',
    textSecondary: isDark ? '#a1a1aa' : '#6b7280',
    titleColor: isDark ? '#818cf8' : '#5B7FFF',
    borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.08)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb',
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Account</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#5B7FFF" />
          <Text style={[{ color: theme.textSecondary, marginTop: 12 }]}>Loading profile...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#5B7FFF"
              colors={['#5B7FFF']}
            />
          }
        >
          {/* Profile Details */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile Details</Text>
            </View>
            {/* <TouchableOpacity onPress={() => handleEditSection('Profile Details')}>
              <Ionicons name="create-outline" size={20} color={theme.titleColor} />
            </TouchableOpacity> */}
          </View>

          <View style={styles.profileSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
              <LazyImage
                uri={profileImage}
                style={styles.avatar}
                initials={userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
              />
            </TouchableOpacity>
            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, { color: theme.text }]}>{userData.name}</Text>
              <Text style={[styles.profileUsername, { color: theme.textSecondary }]}>{userData.username}</Text>
              <View style={styles.emailRow}>
                <Ionicons name="mail-outline" size={16} color={theme.titleColor} />
                <Text style={[styles.profileEmailValue, { color: theme.textSecondary, marginLeft: 6 }]}>{userData.email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Basic Information */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Basic Information</Text>
            </View>
            <TouchableOpacity onPress={() => handleEditSection('Basic Information')}>
              <Ionicons name="create-outline" size={20} color={theme.titleColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="call-outline" size={16} color={theme.titleColor} />
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Mobile Phone</Text>
              </View>
              <View style={styles.infoValueRow}>
                <Text style={[styles.infoValue, { color: theme.text }]}>{userData.phone}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              </View>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email Verified</Text>
              <View style={styles.infoValueRow}>
                <Text style={[styles.infoValue, { color: theme.text }]}>{userData.emailVerified ? 'Yes' : 'No'}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              </View>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone Verified</Text>
              <View style={styles.infoValueRow}>
                <Text style={[styles.infoValue, { color: theme.text }]}>{userData.phoneVerified ? 'Yes' : 'No'}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              </View>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Password</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.password}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Account Status</Text>
              <View style={styles.infoValueRow}>
                <Text style={[styles.infoValue, { color: theme.text }]}>{userData.status}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              </View>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Currency</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.currency}</Text>
            </View>
          </View>
        </View>

        {/* Security & Password */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Security & Password</Text>
            </View>
            <TouchableOpacity onPress={() => handleEditSection('Security & Password')}>
              <Ionicons name="create-outline" size={20} color={theme.titleColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.securityRow}>
            <View style={styles.securityItem}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="key-outline" size={16} color={theme.titleColor} />
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Password</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>••••••••</Text>
            </View>

            <View style={styles.securityItem}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.titleColor} />
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Last Changed</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>Never</Text>
            </View>
          </View>
        </View>

        {/* Referral & Client Information */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="link-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Referral & Client Information</Text>
            </View>
            <TouchableOpacity onPress={() => handleEditSection('Referral & Client Information')}>
              <Ionicons name="create-outline" size={20} color={theme.titleColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.referralGrid}>
            <View style={styles.referralItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Referral Code</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.referralCode}</Text>
            </View>

            <View style={styles.referralItem}>
              <View style={styles.infoValueRow}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Referral Link</Text>
                <TouchableOpacity onPress={() => handleCopy(userData.referralLink, 'Referral Link')}>
                  <Ionicons name="copy-outline" size={16} color={theme.titleColor} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.referralLink}</Text>
            </View>

            <View style={styles.referralItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Referred By</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.referredBy}</Text>
            </View>

            <View style={styles.referralItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Joined By</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.joinedBy}</Text>
            </View>

            <View style={styles.referralItem}>
              <View style={styles.infoValueRow}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Client ID</Text>
                <TouchableOpacity onPress={() => handleCopy(userData.clientId, 'Client ID')}>
                  <Ionicons name="copy-outline" size={16} color={theme.titleColor} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.clientId}</Text>
            </View>

            <View style={styles.referralItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Client Type</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{userData.clientType}</Text>
            </View>
          </View>
        </View>

        {/* KYC & Verification */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="document-text-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>KYC & Verification</Text>
            </View>
            <TouchableOpacity onPress={() => handleEditSection('KYC & Verification')}>
              <Ionicons name="create-outline" size={20} color={theme.titleColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.kycSection}>
            <View style={styles.kycRow}>
              <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
              <Text style={[styles.kycLabel, { color: theme.textSecondary }]}>Verification Status</Text>
            </View>
            <Text style={[styles.kycValue, { color: '#F59E0B' }]}>Unverified</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Edit Basic Information Modal */}
      <Modal
        visible={editingSection === 'Basic Information'}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Basic Information</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>username</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.username}
                    onChangeText={(text) => setFormData({...formData, username: text})}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>email</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.email}
                    onChangeText={(text) => setFormData({...formData, email: text})}
                    keyboardType="email-address"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>phone</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.phone}
                    onChangeText={(text) => setFormData({...formData, phone: text})}
                    keyboardType="phone-pad"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>email Verified</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.input, { color: theme.text }]}>{userData.emailVerified ? 'Yes' : 'No'}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>phone Verified</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.input, { color: theme.text }]}>{userData.phoneVerified ? 'Yes' : 'No'}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.input, { color: theme.text }]}>••••••••</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>status</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.input, { color: theme.text }]}>{userData.status}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>currency</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="globe-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.input, { color: theme.text }]}>{userData.currency}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }]}
                onPress={closeModal}
              >
                <Text style={[styles.buttonText, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.titleColor }]}
                onPress={handleSaveBasicInfo}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={editingSection === 'Security & Password'}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Current Password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>New Password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Confirm New Password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="key-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }]}
                onPress={closeModal}
              >
                <Text style={[styles.buttonText, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.titleColor }]}
                onPress={handleChangePassword}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Change Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Referral Modal */}
      <Modal
        visible={editingSection === 'Referral & Client Information'}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Referral</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>referral Code</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="pricetag-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.referralCode}
                    onChangeText={(text) => setFormData({...formData, referralCode: text})}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>referral Link</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="link-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.referralLink}
                    onChangeText={(text) => setFormData({...formData, referralLink: text})}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>referred By</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.referredBy}
                    onChangeText={(text) => setFormData({...formData, referredBy: text})}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>joined By</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.joinedBy}
                    onChangeText={(text) => setFormData({...formData, joinedBy: text})}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>client Id</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="card-outline" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={formData.clientId}
                    onChangeText={(text) => setFormData({...formData, clientId: text})}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>client Type</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.borderColor }]}>
                  <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.input, { color: theme.text }]}>{userData.clientType}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }]}
                onPress={closeModal}
              >
                <Text style={[styles.buttonText, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.titleColor }]}
                onPress={handleSaveReferral}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload KYC Documents Modal */}
      <Modal
        visible={editingSection === 'KYC & Verification'}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Upload KYC Documents</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.documentTitle, { color: theme.text }]}>PAN Card</Text>
                <TouchableOpacity 
                  style={[styles.documentButton, { borderColor: theme.titleColor }]}
                  onPress={() => pickDocument('pan')}
                >
                  <Ionicons name="document-outline" size={20} color={theme.titleColor} />
                  <Text style={[styles.documentButtonText, { color: theme.titleColor }]}>
                    {panDocument ? 'PAN Selected' : 'Select PAN'}
                  </Text>
                </TouchableOpacity>
                {panDocument && (
                  <Image source={{ uri: panDocument }} style={styles.documentPreview} />
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.documentTitle, { color: theme.text }]}>Aadhaar Card</Text>
                <TouchableOpacity 
                  style={[styles.documentButton, { borderColor: theme.titleColor }]}
                  onPress={() => pickDocument('aadhaar')}
                >
                  <Ionicons name="document-outline" size={20} color={theme.titleColor} />
                  <Text style={[styles.documentButtonText, { color: theme.titleColor }]}>
                    {aadhaarDocument ? 'Aadhaar Selected' : 'Select Aadhaar'}
                  </Text>
                </TouchableOpacity>
                {aadhaarDocument && (
                  <Image source={{ uri: aadhaarDocument }} style={styles.documentPreview} />
                )}
              </View>

              <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF' }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.titleColor} />
                <Text style={[styles.infoText, { color: theme.titleColor }]}>
                  Accepted formats: JPG, PNG, PDF (Max 5MB)
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }]}
                onPress={closeModal}
              >
                <Text style={[styles.buttonText, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.titleColor }]}
                onPress={handleUploadKYC}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    marginBottom: 12,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  profileEmailValue: {
    fontSize: 13,
  },
  uploadBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoItem: {
    width: '47%',
    marginBottom: 8,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  securityRow: {
    flexDirection: 'row',
    gap: 32,
  },
  securityItem: {
    flex: 1,
  },
  referralGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  referralItem: {
    width: '47%',
    marginBottom: 8,
  },
  kycSection: {
    gap: 8,
  },
  kycRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kycLabel: {
    fontSize: 14,
  },
  kycValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'lowercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    // backgroundColor set dynamically
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  documentButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  documentPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    resizeMode: 'cover',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
