export interface Coordinates {
  lat: number;
  lng: number;
}

export class GeolocationError extends Error {}

/** Wraps the browser Geolocation API in a Promise with a sane timeout for a field check-in/out. */
export function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new GeolocationError("This device doesn't support location — GPS is required to check in."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (error) => {
        reject(new GeolocationError(error.message || "Failed to get your location."));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
