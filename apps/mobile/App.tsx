import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ScrollView, ActivityIndicator, Alert, Modal, Switch 
} from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { 
  MapPin, Navigation, Plus, ThumbsUp, ThumbsDown, 
  ShieldAlert, ShieldCheck, AlertTriangle 
} from 'lucide-react-native';
import { 
  CameraLocationSummary, 
  CameraLocation, 
  CameraType, 
  LocationStatus, 
  LEGAL_DISCLAIMER 
} from '@flockgps/shared';

// Replace with local/Railway API URL
const API_URL = 'http://localhost:3001/api/v1';

export default function App() {
  const mapRef = useRef<MapView | null>(null);

  // States
  const [locations, setLocations] = useState<CameraLocationSummary[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraLocation | null>(null);
  const [submittingCoords, setSubmittingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [loading, setLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  // Form States
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.ALPR);
  const [description, setDescription] = useState('');

  // Ask for Location permissions on load
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        const newRegion = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion);
      }
    })();
  }, []);

  // Fetch locations inside region
  const fetchLocations = async (r: Region) => {
    try {
      const north = r.latitude + r.latitudeDelta / 2;
      const south = r.latitude - r.latitudeDelta / 2;
      const east = r.longitude + r.longitudeDelta / 2;
      const west = r.longitude - r.longitudeDelta / 2;

      const res = await fetch(
        `${API_URL}/locations?north=${north}&south=${south}&east=${east}&west=${west}&limit=100`
      );
      const result = await res.json();
      if (result.success && result.data) {
        setLocations(result.data);
      }
    } catch (err) {
      console.warn('Network error fetching locations:', err);
    }
  };

  // Trigger locations load when region changes
  useEffect(() => {
    fetchLocations(region);
  }, [region]);

  const handleSelectCamera = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/locations/${id}`);
      const result = await res.json();
      if (result.success && result.data) {
        setSelectedCamera(result.data);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', 'Failed to retrieve camera details.');
    }
  };

  const handleLocateUser = async () => {
    let loc = await Location.getCurrentPositionAsync({});
    const newRegion = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
    mapRef.current?.animateToRegion(newRegion);
  };

  const handleMapPress = (e: any) => {
    // Drop submission pin on long press or tap if not clicking existing
    const coords = e.nativeEvent.coordinate;
    setSubmittingCoords({
      lat: coords.latitude,
      lng: coords.longitude,
    });
    setSelectedCamera(null);
  };

  const handleSubmitCamera = async () => {
    if (!submittingCoords) return;
    try {
      const body = {
        lat: submittingCoords.lat,
        lng: submittingCoords.lng,
        address: address || undefined,
        city: city || undefined,
        state: stateVal || undefined,
        cameraType,
        description: description || undefined,
      };

      const res = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.success) {
        Alert.alert('Success', 'Location submitted.');
        setSubmittingCoords(null);
        setAddress('');
        setCity('');
        setStateVal('');
        setDescription('');
        fetchLocations(region);
      } else {
        Alert.alert('Submission Failed', result.error || 'Server error.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Could not connect to FlockGPS server.');
    }
  };

  const handleVote = async (vote: 'up' | 'down') => {
    if (!selectedCamera) return;
    try {
      const res = await fetch(`${API_URL}/verify/${selectedCamera.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setSelectedCamera({ ...selectedCamera, ...result.data });
        fetchLocations(region);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to submit validation vote.');
    }
  };

  return (
    <View style={styles.container}>
      {/* ─── Legal Disclaimer Modal ─── */}
      <Modal visible={!legalAccepted} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AlertTriangle color="#ef4444" size={28} />
              <Text style={styles.modalTitle}>Disclaimer Notice</Text>
            </View>
            <ScrollView style={styles.disclaimerScroll}>
              <Text style={styles.disclaimerText}>{LEGAL_DISCLAIMER}</Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={() => setLegalAccepted(true)}
            >
              <ShieldCheck color="#fff" size={20} />
              <Text style={styles.acceptButtonText}>I Agree & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Main Map ─── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onLongPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Submitted Camera Markers */}
        {locations.map((loc) => (
          <Marker
            key={loc.id}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            pinColor={
              loc.status === 'verified' ? '#10b981' : 
              loc.status === 'disputed' ? '#ef4444' : '#f59e0b'
            }
            onPress={() => handleSelectCamera(loc.id)}
          />
        ))}

        {/* Temporary Submission Pin */}
        {submittingCoords && (
          <Marker
            coordinate={{ latitude: submittingCoords.lat, longitude: submittingCoords.lng }}
            pinColor="#a855f7"
            title="Drop camera here"
          />
        )}
      </MapView>

      {/* ─── Floating Controls ─── */}
      <TouchableOpacity style={styles.locateButton} onPress={handleLocateUser}>
        <Navigation color="#fff" size={20} />
      </TouchableOpacity>

      {/* ─── Bottom Sheets / Info Panels ─── */}
      {selectedCamera && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{selectedCamera.address || 'Camera Detail'}</Text>
            <Text style={styles.sheetBadge}>{selectedCamera.status}</Text>
          </View>
          <Text style={styles.sheetSub}>
            Confidence Score: {selectedCamera.confidenceScore}% | Type: {selectedCamera.cameraType.toUpperCase()}
          </Text>
          
          {selectedCamera.description && (
            <Text style={styles.sheetDesc}>{selectedCamera.description}</Text>
          )}

          <View style={styles.voteRow}>
            <TouchableOpacity style={[styles.voteBtn, styles.btnUp]} onPress={() => handleVote('up')}>
              <ThumbsUp color="#fff" size={16} />
              <Text style={styles.voteBtnText}>Verify ({selectedCamera.upvotes})</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.voteBtn, styles.btnDown]} onPress={() => handleVote('down')}>
              <ThumbsDown color="#fff" size={16} />
              <Text style={styles.voteBtnText}>Dispute ({selectedCamera.downvotes})</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedCamera(null)}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Camera Submission Panel ─── */}
      {submittingCoords && !selectedCamera && (
        <View style={styles.bottomSheet}>
          <Text style={styles.sheetTitle}>Submit Camera Coordinates</Text>
          <Text style={styles.coordsText}>
            ({submittingCoords.lat.toFixed(5)}, {submittingCoords.lng.toFixed(5)})
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Street / Intersection"
            placeholderTextColor="#64748b"
            value={address}
            onChangeText={setAddress}
          />
          
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="City"
              placeholderTextColor="#64748b"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
              placeholder="State"
              placeholderTextColor="#64748b"
              maxLength={2}
              value={stateVal}
              onChangeText={setStateVal}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Details / Mounting pole notes"
            placeholderTextColor="#64748b"
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitCamera}>
              <Text style={styles.submitBtnText}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSubmittingCoords(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  locateButton: {
    position: 'absolute',
    right: 20,
    top: 50,
    backgroundColor: '#6366f1',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(26, 26, 42, 0.95)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  sheetBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  sheetSub: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
  },
  sheetDesc: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  btnUp: {
    backgroundColor: '#10b981',
  },
  btnDown: {
    backgroundColor: '#ef4444',
  },
  voteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  closeBtn: {
    alignItems: 'center',
    padding: 10,
    marginTop: 10,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  coordsText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#151525',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  disclaimerScroll: {
    marginBottom: 20,
  },
  disclaimerText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
  acceptButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});
