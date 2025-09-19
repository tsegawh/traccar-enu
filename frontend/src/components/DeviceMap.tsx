import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for online/offline devices
const createDeviceIcon = (isOnline: boolean) => {
  return L.divIcon({
    className: 'custom-device-marker',
    html: `
      <div class="relative">
        <div class="w-8 h-8 rounded-full ${isOnline ? 'bg-success-500' : 'bg-gray-400'} border-2 border-white shadow-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
          </svg>
        </div>
        ${isOnline ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-success-400 rounded-full animate-ping"></div>' : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

interface Device {
  id: string;
  name: string;
  uniqueId: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  lastUpdate: string | null;
  isOnline?: boolean;
}

interface DeviceMapProps {
  devices: Device[];
  selectedDevice?: Device | null;
  routeData?: Array<{
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: string;
  }>;
  showRoute?: boolean;
}

// Component to handle map bounds and center
function MapController({ devices, selectedDevice, routeData }: DeviceMapProps) {
  const map = useMap();

  useEffect(() => {
    if (routeData && routeData.length > 0) {
      // Fit bounds to show entire route
      const bounds = L.latLngBounds(
        routeData.map(point => [point.latitude, point.longitude])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (selectedDevice && selectedDevice.latitude && selectedDevice.longitude) {
      // Center on selected device
      map.setView([selectedDevice.latitude, selectedDevice.longitude], 15);
    } else if (devices.length > 0) {
      // Fit bounds to show all devices
      const validDevices = devices.filter(d => d.latitude && d.longitude);
      if (validDevices.length > 0) {
        const bounds = L.latLngBounds(
          validDevices.map(d => [d.latitude!, d.longitude!])
        );
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [map, devices, selectedDevice, routeData]);

  return null;
}

export default function DeviceMap({ devices, selectedDevice, routeData, showRoute }: DeviceMapProps) {
  const mapRef = useRef<L.Map>(null);

  // Filter devices with valid coordinates
  const validDevices = devices.filter(device => 
    device.latitude !== null && device.longitude !== null
  );

  // Check if we have route data to display
  const hasRouteData = routeData && routeData.length > 0;
  const hasValidDevices = validDevices.length > 0;

  // Default center (Addis Ababa, Ethiopia)
  const defaultCenter: [number, number] = [9.0320, 38.7469];

  // Determine initial center and zoom based on available data
  const getInitialView = (): { center: [number, number]; zoom: number } => {
    if (hasRouteData) {
      const firstPoint = routeData[0];
      return { center: [firstPoint.latitude, firstPoint.longitude], zoom: 13 };
    }
    if (hasValidDevices) {
      const firstDevice = validDevices[0];
      return { center: [firstDevice.latitude!, firstDevice.longitude!], zoom: 13 };
    }
    return { center: defaultCenter, zoom: 10 };
  };

  const initialView = getInitialView();
  return (
    <div className="h-96 w-full relative">
      {!hasValidDevices && !hasRouteData ? (
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No device locations</h3>
            <p className="text-gray-600">
              {showRoute ? 'No route data available for the selected period' : 'Device locations will appear here once they start reporting GPS data'}
            </p>
          </div>
        </div>
      ) : (
        <MapContainer
          ref={mapRef}
          center={initialView.center}
          zoom={initialView.zoom}
          className="h-full w-full rounded-lg"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController devices={devices} selectedDevice={selectedDevice} routeData={routeData} />

          {/* Route polyline */}
          {showRoute && routeData && routeData.length > 1 && (
            <Polyline
              positions={routeData.map(point => [point.latitude, point.longitude])}
              color="#2563eb"
              weight={3}
              opacity={0.8}
              dashArray="5, 5"
            />
          )}

          {/* Route start and end markers */}
          {showRoute && routeData && routeData.length > 0 && (
            <>
              {/* Start marker */}
              <Marker
                position={[routeData[0].latitude, routeData[0].longitude]}
                icon={L.divIcon({
                  className: 'custom-route-marker',
                  html: `
                    <div class="w-6 h-6 bg-green-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center">
                      <span class="text-white text-xs font-bold">S</span>
                    </div>
                  `,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>Route Start</strong><br/>
                    Time: {new Date(routeData[0].timestamp).toLocaleString()}<br/>
                    Speed: {Math.round(routeData[0].speed)} km/h
                  </div>
                </Popup>
              </Marker>

              {/* End marker */}
              {routeData.length > 1 && (
                <Marker
                  position={[routeData[routeData.length - 1].latitude, routeData[routeData.length - 1].longitude]}
                  icon={L.divIcon({
                    className: 'custom-route-marker',
                    html: `
                      <div class="w-6 h-6 bg-red-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center">
                        <span class="text-white text-xs font-bold">E</span>
                      </div>
                    `,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                  })}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>Route End</strong><br/>
                      Time: {new Date(routeData[routeData.length - 1].timestamp).toLocaleString()}<br/>
                      Speed: {Math.round(routeData[routeData.length - 1].speed)} km/h
                    </div>
                  </Popup>
                </Marker>
              )}
            </>
          )}
          {validDevices.map((device) => (
            <Marker
              key={device.id}
              position={[device.latitude!, device.longitude!]}
              icon={createDeviceIcon(device.isOnline || false)}
            >
              <Popup>
                <div className="p-2 min-w-48">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{device.name}</h3>
                    <span className={`badge ${device.isOnline ? 'badge-success' : 'badge-gray'}`}>
                      {device.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-medium">{device.uniqueId}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-medium">
                        {device.latitude?.toFixed(6)}, {device.longitude?.toFixed(6)}
                      </span>
                    </div>
                    
                    {device.speed !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Speed:</span>
                        <span className="font-medium">{Math.round(device.speed)} km/h</span>
                      </div>
                    )}
                    
                    {device.course !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Direction:</span>
                        <span className="font-medium">{Math.round(device.course)}°</span>
                      </div>
                    )}
                    
                    {device.lastUpdate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Update:</span>
                        <span className="font-medium">
                          {new Date(device.lastUpdate).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          {showRoute ? 'Route Legend' : 'Device Status'}
        </h4>
        <div className="space-y-2">
          {showRoute ? (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Start</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-xs text-gray-600">End</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-1 bg-blue-600"></div>
                <span className="text-xs text-gray-600">Route</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-success-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="text-xs text-gray-600">Offline</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}