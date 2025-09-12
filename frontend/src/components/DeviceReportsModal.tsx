@@ .. @@
 import React, { useState, useEffect } from 'react';
-import { X, Calendar, MapPin, Clock, TrendingUp } from 'lucide-react';
+import { X, Calendar, MapPin, Clock, TrendingUp, Download, Route } from 'lucide-react';
 import axios from 'axios';
 import toast from 'react-hot-toast';
 import { format } from 'date-fns';
+import DeviceMap from './DeviceMap';

@@ .. @@
   const [activeTab, setActiveTab] = useState<'summary' | 'route' | 'positions'>('summary');
   const [dateRange, setDateRange] = useState({
     from: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
     to: format(new Date(), 'yyyy-MM-dd')
   });
   const [reports, setReports] = useState<any>(null);
+  const [routeData, setRouteData] = useState<any[]>([]);
   const [loading, setLoading] = useState(false);

@@ .. @@
   const fetchReports = async () => {
     setLoading(true);
     try {
-      const response = await axios.get(`/api/device/${device.id}/reports`, {
+      const [reportsResponse, positionsResponse] = await Promise.all([
+        axios.get(`/api/device/${device.id}/reports`, {
+          params: {
+            from: `${dateRange.from}T00:00:00Z`,
+            to: `${dateRange.to}T23:59:59Z`
+          }
+        }),
+        axios.get(`/api/device/${device.id}/positions`, {
+          params: {
+            from: `${dateRange.from}T00:00:00Z`,
+            to: `${dateRange.to}T23:59:59Z`,
+            limit: 1000
+          }
+        })
+      ]);
+      
+      setReports(reportsResponse.data);
+      setRouteData(positionsResponse.data.positions.map((pos: any) => ({
+        latitude: pos.latitude,
+        longitude: pos.longitude,
+        speed: pos.speed || 0,
+        timestamp: pos.fixTime
+      })));
+    } catch (error) {
+      console.error('Error fetching reports:', error);
+      toast.error('Failed to load reports');
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  const exportData = (type: string) => {
+    if (!reports) return;
+    
+    let data: any;
+    let filename: string;
+    
+    switch (type) {
+      case 'summary':
+        data = reports.summary;
+        filename = `${device.name}_summary_${dateRange.from}_${dateRange.to}.json`;
+        break;
+      case 'route':
+        data = routeData;
+        filename = `${device.name}_route_${dateRange.from}_${dateRange.to}.json`;
+        break;
+      case 'positions':
+        data = reports.positions;
+        filename = `${device.name}_positions_${dateRange.from}_${dateRange.to}.json`;
+        break;
+      default:
+        return;
+    }
+    
+    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
+    const url = URL.createObjectURL(blob);
+    const a = document.createElement('a');
+    a.href = url;
+    a.download = filename;
+    document.body.appendChild(a);
+    a.click();
+    document.body.removeChild(a);
+    URL.revokeObjectURL(url);
+  };

@@ .. @@
           {/* Tabs */}
           <div className="flex border-b border-gray-200 mb-6">
             {[
               { id: 'summary', label: 'Summary', icon: TrendingUp },
-              { id: 'route', label: 'Route', icon: MapPin },
+              { id: 'route', label: 'Route', icon: Route },
               { id: 'positions', label: 'Positions', icon: Clock }
             ].map((tab) => {
               const Icon = tab.icon;
@@ .. @@
           {/* Tab Content */}
           {activeTab === 'summary' && (
             <div className="space-y-6">
+              <div className="flex justify-between items-center">
+                <h3 className="text-lg font-semibold text-gray-900">Summary Report</h3>
+                <button
+                  onClick={() => exportData('summary')}
+                  className="btn-secondary text-sm"
+                >
+                  <Download className="w-4 h-4 mr-2" />
+                  Export
+                </button>
+              </div>
+              
               {reports?.summary && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-gray-50 rounded-lg p-4">
@@ .. @@
           )}

           {activeTab === 'route' && (
-            <div className="space-y-4">
-              <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
-              <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
-                <p className="text-gray-500">Route map will be displayed here</p>
+            <div className="space-y-6">
+              <div className="flex justify-between items-center">
+                <h3 className="text-lg font-semibold text-gray-900">Route Map</h3>
+                <button
+                  onClick={() => exportData('route')}
+                  className="btn-secondary text-sm"
+                >
+                  <Download className="w-4 h-4 mr-2" />
+                  Export Route
+                </button>
+              </div>
+              
+              {routeData.length > 0 ? (
+                <div className="space-y-4">
+                  <DeviceMap
+                    devices={[]}
+                    routeData={routeData}
+                    showRoute={true}
+                  />
+                  
+                  <div className="bg-gray-50 rounded-lg p-4">
+                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
+                      <div>
+                        <span className="text-gray-600">Total Points:</span>
+                        <span className="font-medium ml-2">{routeData.length}</span>
+                      </div>
+                      <div>
+                        <span className="text-gray-600">Start Time:</span>
+                        <span className="font-medium ml-2">
+                          {routeData[0] ? format(new Date(routeData[0].timestamp), 'HH:mm') : 'N/A'}
+                        </span>
+                      </div>
+                      <div>
+                        <span className="text-gray-600">End Time:</span>
+                        <span className="font-medium ml-2">
+                          {routeData[routeData.length - 1] ? format(new Date(routeData[routeData.length - 1].timestamp), 'HH:mm') : 'N/A'}
+                        </span>
+                      </div>
+                      <div>
+                        <span className="text-gray-600">Max Speed:</span>
+                        <span className="font-medium ml-2">
+                          {Math.max(...routeData.map(p => p.speed)).toFixed(1)} km/h
+                        </span>
+                      </div>
+                    </div>
+                  </div>
+                </div>
+              ) : (
+                <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
+                  <p className="text-gray-500">No route data available for selected period</p>
+                </div>
+              )}
+            </div>
+          )}
+
+          {activeTab === 'positions' && (
+            <div className="space-y-6">
+              <div className="flex justify-between items-center">
+                <h3 className="text-lg font-semibold text-gray-900">Position History</h3>
+                <button
+                  onClick={() => exportData('positions')}
+                  className="btn-secondary text-sm"
+                >
+                  <Download className="w-4 h-4 mr-2" />
+                  Export
+                </button>
               </div>
+              
+              {reports?.positions && reports.positions.length > 0 ? (
+                <div className="overflow-x-auto">
+                  <table className="w-full text-sm">
+                    <thead className="bg-gray-50">
+                      <tr>
+                        <th className="px-4 py-2 text-left">Time</th>
+                        <th className="px-4 py-2 text-left">Latitude</th>
+                        <th className="px-4 py-2 text-left">Longitude</th>
+                        <th className="px-4 py-2 text-left">Speed</th>
+                        <th className="px-4 py-2 text-left">Course</th>
+                      </tr>
+                    </thead>
+                    <tbody className="divide-y divide-gray-200">
+                      {reports.positions.slice(0, 100).map((position: any, index: number) => (
+                        <tr key={index} className="hover:bg-gray-50">
+                          <td className="px-4 py-2">
+                            {format(new Date(position.fixTime), 'MMM dd, HH:mm:ss')}
+                          </td>
+                          <td className="px-4 py-2 font-mono">
+                            {position.latitude.toFixed(6)}
+                          </td>
+                          <td className="px-4 py-2 font-mono">
+                            {position.longitude.toFixed(6)}
+                          </td>
+                          <td className="px-4 py-2">
+                            {position.speed ? `${position.speed.toFixed(1)} km/h` : '0 km/h'}
+                          </td>
+                          <td className="px-4 py-2">
+                            {position.course ? `${position.course.toFixed(0)}°` : 'N/A'}
+                          </td>
+                        </tr>
+                      ))}
+                    </tbody>
+                  </table>
+                  
+                  {reports.positions.length > 100 && (
+                    <div className="mt-4 text-center text-sm text-gray-500">
+                      Showing first 100 of {reports.positions.length} positions
+                    </div>
+                  )}
+                </div>
+              ) : (
+                <div className="text-center py-8 text-gray-500">
+                  No position data available for selected period
+                </div>
+              )}
             </div>
           )}