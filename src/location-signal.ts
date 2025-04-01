import { computed } from "@lit-labs/signals";
import { listeningSignal } from "./async-signal";

export const deviceOrientation = listeningSignal<DeviceOrientationEvent>(
	(update) => {
		const callback = (e: DeviceOrientationEvent) => {
			update(e);
		};
		window.addEventListener("deviceorientation", callback, true);
		return () => {
			window.removeEventListener("deviceorientation", callback);
		};
	},
);
export const absoluteDeviceOrientation =
	listeningSignal<DeviceOrientationEvent>((update) => {
		const callback = (e: DeviceOrientationEvent) => {
			update(e);
		};
		window.addEventListener("deviceorientationabsolute", callback, true);
		return () => {
			window.removeEventListener("deviceorientationabsolute", callback);
		};
	});

export const geolocation = listeningSignal<
	GeolocationPosition | GeolocationPositionError
>((update) => {
	const callback: PositionCallback = (e) => {
		update(e);
	};
	const error: PositionErrorCallback = (e) => {
		update(e);
	};
	const id = navigator.geolocation.watchPosition(callback, error, {
		maximumAge: 3_000,
		enableHighAccuracy: true,
	});
	return () => {
		navigator.geolocation.clearWatch(id);
	};
});

export const deviceOrientationAbsoluteWhenAvailable = computed(() => {
	const absoluteOrientation = absoluteDeviceOrientation.get();
	if (absoluteOrientation?.alpha != undefined) {
		return absoluteOrientation;
	}
	return deviceOrientation.get();
});

export const compassHeading = computed(() => {
	const orientation = deviceOrientationAbsoluteWhenAvailable.get();
	return orientation?.alpha;
});
