"use client";

import React, { useState, useEffect } from "react";
import AssetsSidebar from "@/src/lib/components/assets-sidebar";
import { Map as MapLibreMap } from "maplibre-gl";
import { Settings, MapPin, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Complaint } from "@/src/types/complaint";

const ManageAssetsMap = dynamic(
  () => import("@/src/lib/components/manage-assets-map"),
  { ssr: false }
);

interface Asset {
  id: string;
  name: string;
  description: string;
  lng: number;
  lat: number;
  color: string;
}

interface Log {
  id: string;
  title: string;
  type: string;
  description: string;
  technician: string;
  updatedAt: string;
  assetId: string;
}

export interface MapInfo {
  zoom: number;
  center: [number, number];
}

type TabType = 'assets' | 'complaints';

export default function ManagePage() {
  const router = useRouter();
  const [mapInfo, setMapInfo] = useState<MapInfo | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('assets');
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [resolvingComplaintId, setResolvingComplaintId] = useState<string | null>(null);

  async function fetchAssets() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/assets/all");
      if (!response.ok) {
        throw new Error("Failed to fetch assets");
      }
      const data = await response.json();

      // Convert decimal strings to numbers for lng/lat
      const processedAssets = data.map((asset: any) => ({
        ...asset,
        lng: parseFloat(asset.lng),
        lat: parseFloat(asset.lat),
      }));

      setAssets(processedAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLogs() {
    try {
      const response = await fetch("/api/logs");
      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }
      const data = await response.json();

      // Format logs for display - mapping database structure to UI
      const formattedLogs: Log[] = data.map((log: any) => ({
        id: log.id,
        title: log.title,
        type: log.jobType,
        description: log.description,
        technician: log.technician,
        updatedAt: log.updatedAt || log.createdAt,
        assetId: log.assetId,
      }));

      setLogs(formattedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }

  async function fetchComplaints() {
    try {
      setComplaintsLoading(true);
      const response = await fetch("/api/complaints");
      if (!response.ok) {
        throw new Error("Failed to fetch complaints");
      }
      const data = await response.json();
      
      // Filter for reviewed, unresolved complaints and sort by createdAt
      const reviewedComplaints = data
        .filter((complaint: Complaint) => complaint.reviewed === true && complaint.status !== 'resolved')
        .sort((a: Complaint, b: Complaint) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      
      setComplaints(reviewedComplaints);
    } catch (error) {
      console.error("Error fetching complaints:", error);
    } finally {
      setComplaintsLoading(false);
    }
  }

  async function handleResolveComplaint(complaintId: string) {
    if (resolvingComplaintId) return;
    setResolvingComplaintId(complaintId);
    try {
      const response = await fetch(`/api/complaints/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: complaintId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resolve complaint');
      }

      setComplaints(prevComplaints => prevComplaints.filter(c => c.id !== complaintId));
    } catch (error) {
      console.error("Error resolving complaint:", error);
      // Here you might want to show an error to the user
    } finally {
      setResolvingComplaintId(null);
    }
  }

  useEffect(() => {
    fetchAssets();
    fetchLogs();
    fetchComplaints();
  }, []);

  function handleAssetsChange(newAssets: Asset[]) {
    setAssets(newAssets);
  }

  function handleLogsChange(newLogs: Log[]) {
    setLogs(newLogs);
  }

  function handleToggleAddingAsset() {
    setIsAddingAsset(!isAddingAsset);
  }

  function handleGoHome() {
    router.push("/dashboard");
  }
  
  function handleTabChange(tab: TabType) {
    setActiveTab(tab);
    // Exit adding mode when switching tabs
    if (isAddingAsset) {
      setIsAddingAsset(false);
    }
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="flex flex-col w-full h-screen">
      {/* Header - Fixed at top */}
      <div className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">

            <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-blue-100 rounded-xl cursor-pointer hover:bg-blue-200" onClick={handleGoHome}>
                <Home className="h-6 w-6 text-blue-600" />
              </div>
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Manage {activeTab === 'assets' ? 'Assets' : 'Complaints'}
                  </h1>
                  {isAddingAsset && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Adding Mode
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <p className="text-sm text-gray-600">
                    {activeTab === 'assets' ? (
                      isAddingAsset
                        ? "Click anywhere on the map to add a new asset"
                        : "Click 'Add Asset' in the sidebar to start adding assets • Drag existing markers to move them"
                    ) : (
                      "Viewing reviewed complaints on the map"
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Asset counter and Go Home button */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {activeTab === 'assets' 
                    ? (isLoading ? "..." : assets.length)
                    : (complaintsLoading ? "..." : complaints.length)
                  }
                </p>
                <p className="text-xs text-gray-500">
                  Total {activeTab === 'assets' ? 'Assets' : 'Reviewed Complaints'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex w-full flex-1 h-4/5">
        <div className="w-1/4 h-full">
          {/* <AssetsSidebar
            assets={assets}
            onAssetsChange={handleAssetsChange}
            logs={logs}
            onLogsChange={handleLogsChange}
            isAddingAsset={isAddingAsset}
            onToggleAddingAsset={handleToggleAddingAsset}
          /> */}
          <div className="bg-white border-r border-gray-200 flex flex-col h-full max-h-full overflow-hidden space-y-3">
            {/* Tab Selector */}
            <div className="px-3 py-3 flex-shrink-0 border-b border-gray-200">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleTabChange('assets')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'assets'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Assets
                </button>
                <button
                  onClick={() => handleTabChange('complaints')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'complaints'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Complaints
                </button>
              </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'assets' ? (
                <div className="flex flex-col h-full pb-4 overflow-hidden">
                    <AssetsSidebar
                      assets={assets}
                      onAssetsChange={handleAssetsChange}
                      isAddingAsset={isAddingAsset}
                      onToggleAddingAsset={handleToggleAddingAsset}
                      logs={logs}
                      onLogsChange={handleLogsChange}
                    />
                </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Complaints List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
                  {complaintsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading complaints...</p>
                    </div>
                  ) : complaints.length === 0 ? (
                    <div className="text-center py-12">
                      <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-sm">
                        No reviewed complaints found.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {complaints.map((complaint) => (
                        <div
                          key={complaint.id}
                          className="rounded-lg px-3 py-4 border border-gray-200 hover:border-gray-300"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h3 className="font-sm font-semibold text-gray-900 text-sm">
                                {complaint.name || 'Anonymous'}
                              </h3>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(complaint.status)}`}>
                                {complaint.status.replace('_', ' ')}
                              </span>
                            </div>
                            
                            <p className="text-xs text-gray-600 line-clamp-3">
                              {complaint.description.length > 80
                                ? `${complaint.description.substring(0, 80)}...`
                                : complaint.description}
                            </p>
                            
                            <div className="flex items-center text-xs text-gray-500">
                              <MapPin className="h-3 w-3 mr-1" />
                              <span className="truncate">
                                {complaint.location.length > 30
                                  ? `${complaint.location.substring(0, 30)}...`
                                  : complaint.location}
                              </span>
                            </div>
                            
                            <div className="text-xs text-gray-400">
                              {formatDate(complaint.createdAt)}
                            </div>
                            
                            {complaint.email && (
                              <div className="text-xs text-blue-600">
                                {complaint.email}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`resolve-${complaint.id}`}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                                checked={resolvingComplaintId === complaint.id}
                                onChange={() => handleResolveComplaint(complaint.id)}
                                disabled={resolvingComplaintId !== null}
                              />
                              <label
                                htmlFor={`resolve-${complaint.id}`}
                                className={`ml-2 block text-sm ${resolvingComplaintId === complaint.id ? 'text-gray-500' : 'text-gray-700'}`}
                              >
                                {resolvingComplaintId === complaint.id ? 'Resolving...' : 'Mark as resolved'}
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="w-3/4 h-full">
          {!isLoading && (
            <ManageAssetsMap
              onInit={(map) => setMap(map)}
              onMove={(info) => setMapInfo(info as any)}
              assets={assets}
              onAssetsChange={handleAssetsChange}
              isAddingAsset={isAddingAsset}
              onAssetAdded={() => setIsAddingAsset(false)}
            />
          )}
          {isLoading && (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading assets...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}