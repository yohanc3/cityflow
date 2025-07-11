import React, { ReactElement, useEffect, useRef, useState } from "react";
import maplibregl, { LngLat, LngLatBounds, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

const STYLE = `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_API_KEY}`;

export type MapInfo = {
  bounds: LngLatBounds;
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
};

interface Asset {
  id: string;
  name: string;
  description: string;
  lng: number;
  lat: number;
  color: string;
}

interface ClickLocation {
  lng: number;
  lat: number;
}

interface MapProps {
  children?: ReactElement | ReactElement[];
  onInit: (map: maplibregl.Map) => void;
  onMove: (info: MapInfo) => void;
  assets: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  isAddingAsset: boolean;
  onAssetAdded: () => void;
}

export default function ManageAssetsMap({
  children,
  onInit,
  onMove,
  assets,
  onAssetsChange,
  isAddingAsset,
  onAssetAdded,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clickLocation, setClickLocation] = useState<ClickLocation | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    lng: "",
    lat: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Handle map click to open dialog
  function handleMapClick(e: any) {
    // Only handle clicks if we're in adding mode
    if (!isAddingAsset) return;

    const { lng, lat } = e.lngLat;
    setClickLocation({ lng, lat });
    setFormData({
      name: "",
      description: "",
      lng: lng.toFixed(6),
      lat: lat.toFixed(6),
    });
    setIsDialogOpen(true);
  }

  // Handle form input changes
  function handleInputChange(field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // Handle form submission
  async function handleAddAsset() {
    if (!formData.name.trim()) return;

    setIsCreating(true);

    try {
      const assetId = uuidv4();
      const newAssetData = {
        id: assetId,
        name: formData.name,
        description: formData.description,
        lng: parseFloat(formData.lng),
        lat: parseFloat(formData.lat),
        color: "#3b82f6",
      };

      const response = await fetch("/api/assets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newAssetData),
      });

      if (response.status === 200) {
        // Success - add to local state and show success toast
        onAssetsChange([...assets, newAssetData]);
        toast.success("Asset created successfully!");
        setIsDialogOpen(false);
        setFormData({ name: "", description: "", lng: "", lat: "" });
        setClickLocation(null);
        onAssetAdded(); // Exit adding mode after successful creation
      } else {
        // Error - show error toast
        toast.error("Failed to create asset. Try again later.");
      }
    } catch (error) {
      console.error("Error creating asset:", error);
      toast.error("Failed to create asset. Try again later.");
    } finally {
      setIsCreating(false);
    }
  }

  // Handle dialog cancel
  function handleCancel() {
    setIsDialogOpen(false);
    setFormData({ name: "", description: "", lng: "", lat: "" });
    setClickLocation(null);
  }

  // Initialize map when component mounts
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STYLE,
      center: [-104.692, 40.376],
      zoom: 14,
    });

    // Add navigation control
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true,
      }),
      "top-right"
    );

    // Wait for map to load before adding event listeners
    map.on("load", () => {
      setMapLoaded(true);
    });

    map.on("move", () =>
      onMove({
        bounds: map.getBounds(),
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      })
    );

    mapRef.current = map;
    onInit(map);

    // Clean up on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when assets change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Remove all existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Create new markers for all assets
    const newMarkers = assets.map((asset) => {
      // Create popup for this marker
      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        offset: [0, -20], // Offset popup above the marker
        className: "asset-popup",
      }).setHTML(
        `<div style="font-size: 11px; font-weight: 500; color: #374151; padding: 2px 2px;">${asset.name}</div>`
      );

      const marker = new Marker({
        color: asset.color,
        draggable: true,
      })
        .setLngLat([asset.lng, asset.lat])
        .setPopup(popup) // Attach popup to marker
        .addTo(mapRef.current!);

      // Show popup immediately and keep it open
      marker.togglePopup();

      // Update asset position when dragged
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        const updatedAssets = assets.map((a) =>
          a.id === asset.id ? { ...a, lng: lngLat.lng, lat: lngLat.lat } : a
        );
        onAssetsChange(updatedAssets);

        // Keep popup open after drag
        if (!marker.getPopup().isOpen()) {
          marker.togglePopup();
        }
      });

      return marker;
    });

    markersRef.current = newMarkers;

    // Cleanup function
    return () => {
      newMarkers.forEach((marker) => marker.remove());
    };
  }, [assets, mapLoaded]);

  // Update cursor style based on adding mode
  useEffect(() => {
    if (!mapRef.current) return;

    const canvas = mapRef.current.getCanvas();
    if (isAddingAsset) {
      canvas.style.cursor = "crosshair";
      mapRef.current.on("click", handleMapClick);
    } else {
      canvas.style.cursor = "";
      mapRef.current.off("click", handleMapClick);
    }

    setIsDialogOpen(false);
  }, [isAddingAsset]);

  return (
    <>
      <style jsx global>{`
        .asset-popup .maplibregl-popup-content {
          background: rgba(255, 255, 255, 0.4);
          border: 1px solid rgba(229, 231, 235, 0.6);
          border-radius: 6px;
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding: 4px 8px;
          font-family:
            system-ui,
            -apple-system,
            sans-serif;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        .asset-popup .maplibregl-popup-tip {
          border-top-color: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        .asset-popup .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
          border-top-color: rgba(255, 255, 255, 0.4);
        }

        .asset-popup .maplibregl-popup-anchor-top .maplibregl-popup-tip {
          border-bottom-color: rgba(255, 255, 255, 0.4);
        }
      `}</style>

      <div ref={mapContainerRef} className="w-full h-full">
        {children}
      </div>

      {/* Add Asset Dialog */}
      <Dialog
        open={isDialogOpen && isAddingAsset}
        onOpenChange={setIsDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                placeholder="Enter asset name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter asset description (optional)"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                rows={3}
                disabled={isCreating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={formData.lng}
                  onChange={(e) => handleInputChange("lng", e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={formData.lat}
                  onChange={(e) => handleInputChange("lat", e.target.value)}
                  disabled={isCreating}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAsset}
              disabled={!formData.name.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
