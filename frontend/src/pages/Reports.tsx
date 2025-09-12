@@ .. @@
 import React, { useState, useEffect } from 'react';
-import { Calendar, MapPin, TrendingUp, Download } from 'lucide-react';
+import { Calendar, MapPin, TrendingUp, Download, FileText, Route } from 'lucide-react';
 import axios from 'axios';
 import toast from 'react-hot-toast';
 import { format } from 'date-fns';
+import DeviceReportsModal from '../components/DeviceReportsModal';

@@ .. @@
   const [devices, setDevices] = useState<Device[]>([]);
   const [selectedDevice, setSelectedDevice] = useState<string>('');
+  const [showReportsModal, setShowReportsModal] = useState(false);
+  const [selectedDeviceForReports, setSelectedDeviceForReports] = useState<Device | null>(null);
   const [dateRange, setDateRange] = useState({
     from: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
     to: format(new Date(), 'yyyy-MM-dd')
@@ .. @@
   const generateReport = async () => {
     if (!selectedDevice) {
-      toast.error('Please select a device');
+      const device = devices.find(d => d.id === selectedDevice);
+      if (device) {
+        setSelectedDeviceForReports(device);
+        setShowReportsModal(true);
+      } else {
+        toast.error('Please select a device');
+      }
       return;
     }

@@ .. @@
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Report Configuration */}
             <div className="lg:col-span-1 space-y-6">
+              {/* Quick Report Cards */}
+              <div className="grid grid-cols-1 gap-4">
+                <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
+                     onClick={() => selectedDevice && generateReport()}>
+                  <div className="flex items-center space-x-3">
+                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
+                      <FileText className="w-5 h-5 text-primary-600" />
+                    </div>
+                    <div>
+                      <h3 className="font-medium text-gray-900">Summary Report</h3>
+                      <p className="text-sm text-gray-600">Distance, speed, time analysis</p>
+                    </div>
+                  </div>
+                </div>
+
+                <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
+                     onClick={() => selectedDevice && generateReport()}>
+                  <div className="flex items-center space-x-3">
+                    <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
+                      <Route className="w-5 h-5 text-success-600" />
+                    </div>
+                    <div>
+                      <h3 className="font-medium text-gray-900">Route Report</h3>
+                      <p className="text-sm text-gray-600">Visual route with map</p>
+                    </div>
+                  </div>
+                </div>

+                <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
+                     onClick={() => selectedDevice && generateReport()}>
+                  <div className="flex items-center space-x-3">
+                    <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
+                      <MapPin className="w-5 h-5 text-warning-600" />
+                    </div>
+                    <div>
+                      <h3 className="font-medium text-gray-900">Position History</h3>
+                      <p className="text-sm text-gray-600">Detailed GPS coordinates</p>
+                    </div>
+                  </div>
+                </div>
+              </div>
+
               {/* Device Selection */}
               <div className="card">
@@ .. @@
               </div>
             </div>
           </div>
+
+          {/* Reports Modal */}
+          {showReportsModal && selectedDeviceForReports && (
+            <DeviceReportsModal
+              device={selectedDeviceForReports}
+              onClose={() => {
+                setShowReportsModal(false);
+                setSelectedDeviceForReports(null);
+              }}
+            />
+          )}
         </div>
       );
     }