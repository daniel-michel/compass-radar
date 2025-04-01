import { computed, signal } from "@lit-labs/signals";

/**
 * @deprecated not tested
 */
export function asyncComputed<S, T>(
	input: () => S,
	compute: (state: S) => PromiseLike<T>
) {
	let counter = 0;
	const sigState = signal<{ count: number; value: T } | undefined>(undefined);
	const computeUpdate = computed(() => {
		const state = input();
		(async () => {
			const count = counter++;
			try {
				const result = await compute(state);
				const current = sigState.get();
				if (!current || current.count < count) {
					sigState.set({
						count,
						value: result,
					});
				}
			} catch (error) {
				console.warn(error);
			}
		})();
		return state;
	});
	return computed(() => {
		computeUpdate.get();
		return sigState.get()?.value;
	});
}

/**
 * **Warning:** once the signal is no longer used one more updated needs to come from the listener before it is cleaned up
 */
export function listeningSignal<T>(
	setup: (update: (value: T) => void) => () => void
) {
	const sigState = signal<T | undefined>(undefined);
	let cleanup: undefined | (() => void);
	let used = false;
	return computed(() => {
		if (!cleanup) {
			cleanup = setup((value) => {
				used = false;
				sigState.set(value);
				setTimeout(() => {
					if (!used && cleanup) {
						cleanup();
						cleanup = undefined;
					}
				});
			});
		}
		used = true;
		return sigState.get();
	});
}
