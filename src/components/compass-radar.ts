import { LitElement, css, html, nothing, svg } from "lit";
import { customElement } from "lit/decorators.js";
import {
	compassHeading,
	deviceOrientationAbsoluteWhenAvailable,
	geolocation,
} from "../location-signal";
import { SignalWatcher } from "@lit-labs/signals";
import { styleMap } from "lit/directives/style-map.js";
import Color from "colorjs.io";
import PinDrop from "../assets/icons/pin_drop.svg";
import WrongLocation from "../assets/icons/wrong_location.svg";
import ArrowUp from "../assets/icons/keyboard_arrow_up.svg";

const EARTH_RADIUS = 6_371_000; // in meters
const HALF_EARTH_CIRCUMFERENCE = Math.PI * EARTH_RADIUS;
const DISTANCE_LOG_FACTOR = 1 / Math.log(HALF_EARTH_CIRCUMFERENCE + 1);

type Coord = [lat: number, lon: number];

type LocationBookmark = {
	coord: Coord;
	hue: number;
	label?: string;
	createdAt?: Date;
};

@customElement("compass-radar")
export class CompassRadar extends SignalWatcher(LitElement) {
	points?: LocationBookmark[] = undefined;
	localStorageKey = "location-bookmarks";

	constructor() {
		super();
		const savedPointsJSON = localStorage.getItem(this.localStorageKey);
		if (savedPointsJSON) {
			this.points = JSON.parse(savedPointsJSON);
		} else {
			this.points = [];
		}
	}

	addBookmark(point: Coord) {
		const hue = Math.random() * 360;
		this.points?.push({
			coord: point,
			hue,
		});
		if (this.points) {
			localStorage.setItem(this.localStorageKey, JSON.stringify(this.points));
		}
		this.requestUpdate();
	}

	clearBookmarks() {
		this.points = [];
		localStorage.removeItem(this.localStorageKey);
		this.requestUpdate();
	}

	render() {
		return html`
			<div class="layout">
				<div class="compass-area">
					<button
						style="right: 0; bottom: 0;"
						@click=${() => {
							const location = geolocation.get();
							if (location instanceof GeolocationPositionError) {
								console.error("Error getting location:", location.message);
								return;
							}
							if (!location) {
								console.error("No location available");
								return;
							}
							const coord: Coord = [
								(location.coords.latitude / 180) * Math.PI,
								(location.coords.longitude / 180) * Math.PI,
							];
							this.addBookmark(coord);
						}}
						tooltip="Add bookmark"
					>
						<img src=${PinDrop} alt="Add bookmark" />
					</button>

					<button
						style="left: 0; bottom: 0;"
						@click=${() => {
							this.clearBookmarks();
						}}
						tooltip="Clear bookmarks"
					>
						<img src=${WrongLocation} alt="Clear bookmarks" />
					</button>
					${this.renderCompass()}
				</div>
			</div>
		`;
	}

	renderCompass() {
		const svgSize = 100;
		const pointsRadius = svgSize * (3 / 100);
		const location = geolocation.get();
		if (location instanceof GeolocationPositionError) {
			return html`<div class="error">
				Error getting location: ${location.message}
			</div>`;
		}
		if (!location) {
			return html`<div class="error">No location available</div>`;
		}
		const distanceToRadius = (distance: number) => {
			const radius =
				(Math.log(distance + 1) * DISTANCE_LOG_FACTOR * svgSize) / 2;
			return radius;
		};
		const coord: Coord = [
			(location.coords.latitude / 180) * Math.PI,
			(location.coords.longitude / 180) * Math.PI,
		];
		const points = this.points ?? [];
		const polarCoordinates = points.map((point) => {
			const dist = distance(coord, point.coord);
			const bearing = calculateBearing(coord, point.coord);
			const radius = distanceToRadius(dist);
			return {
				radius,
				angle: bearing,
				x: Math.cos(bearing - Math.PI / 2) * radius + svgSize / 2,
				y: Math.sin(bearing - Math.PI / 2) * radius + svgSize / 2,
				hue: point.hue,
			};
		});
		return html` ${!deviceOrientationAbsoluteWhenAvailable.get()?.absolute
				? html`<div class="warning">Compass heading unavailable</div>`
				: nothing}
			<div
				class="compass"
				style=${styleMap({
					"--heading": `${compassHeading.get() ?? 0}deg`,
				})}
			>
				<img class="north" src=${ArrowUp} />
				<img class="south" src=${ArrowUp} />
				<img class="west" src=${ArrowUp} />
				<img class="east" src=${ArrowUp} />

				<svg
					width=${svgSize}
					height=${svgSize}
					viewBox="0 0 ${svgSize} ${svgSize}"
				>
					<!-- Define the filter -->
					<defs>
						<filter id="goo" width=${svgSize} height=${svgSize}>
							${polarCoordinates?.map((point, i) => {
								const color = new Color(`oklch(0.3 50% ${point.hue})`);
								return svg`
							<feOffset in="SourceGraphic" result=${`po${i}`} dx=${point.x} dy=${point.y} />
							<feColorMatrix
								in="po${i}"
								mode="matrix"
								values="${color.srgb[0]} 0 0 0 0
									0 ${color.srgb[1]} 0 0 0
									0 0 ${color.srgb[2]} 0 0
									0 0 0 0.8 0"
								result="pof${i}"
							/>
						`;
							})}
							<feFlood flood-color="transparent" result="result0" />
							${points.map(
								(_, i) =>
									svg`<feBlend mode="screen" in="result${i}" in2=${`pof${i}`} result="result${
										i + 1
									}" />`,
							)}
							<feGaussianBlur
								in="result${points.length}"
								stdDeviation="0.7"
								result="blurred"
							/>
							<feColorMatrix
								in="blur"
								mode="matrix"
								values="1 0 0 0 0
									0 1 0 0 0
									0 0 1 0 0
									0 0 0 1.5 -0.2"
								result="goo"
							/>
						</filter>
					</defs>

					<circle
						cx="0"
						cy="0"
						r=${pointsRadius}
						fill="white"
						filter="url(#goo)"
					></circle>

					<circle
						cx=${svgSize / 2}
						cy=${svgSize / 2}
						r=${distanceToRadius(location.coords.accuracy)}
						stroke="hsla(0, 0%, 100%, 0.4)"
						stroke-width=${svgSize * 0.004}
						fill="transparent"
					></circle>
					<g transform="translate(${svgSize / 2} ${svgSize / 2})">
						<text
							x="0"
							y="0"
							transform="rotate(${-(
								compassHeading.get() ?? 0
							)}) translate(0 ${-distanceToRadius(location.coords.accuracy) -
							2})"
							text-anchor="middle"
							fill="white"
							font-size="3"
							dy=".3em"
						>
							${location.coords.accuracy.toFixed(0)} m
						</text>
					</g>
				</svg>
			</div>`;
	}

	static styles = css`
		:host {
			display: block;
			width: 100%;
			height: 100%;
		}

		.layout {
			height: 100%;
			display: grid;
		}
		.compass-area {
			position: relative;
			container-type: size;

			.warning {
				position: absolute;
				top: 0;
				left: 0;
				margin: 1cqmax;
				font-size: 1.8cqmax;
				color: hsl(40, 100%, 70%);
				padding: 0.3em 0.5em;
				border-radius: 0.5em;
				background-color: hsl(40, 100%, 10%);
			}
		}

		.compass {
			background-color: hsl(0, 0%, 0%);
			border-radius: 100%;
			/* border: 0.7cqmin solid hsl(0, 0%, 50%); */
			box-shadow: inset 0 0 4cqmin hsla(0, 0%, 100%, 0.5);
			font-size: 4cqmin;
			width: 95cqmin;
			height: 95cqmin;
			left: 50%;
			top: 50%;
			--heading: 0deg;
			transform: translate(-50%, -50%) rotate(var(--heading));
			position: absolute;

			.north,
			.south,
			.west,
			.east {
				position: absolute;
				padding: 1.5cqmin;

				width: 7cqmin;
				&.north {
					top: 0;
					left: 50%;
					transform: translate(-50%, 0);
					filter: sepia(10) brightness(0.5) saturate(10) hue-rotate(-60deg);
				}
				&.south {
					bottom: 0;
					left: 50%;
					transform: translate(-50%, 0) rotate(180deg);
					filter: sepia(10) brightness(0.5) saturate(10) hue-rotate(180deg);
				}
				&.west,
				&.east {
					top: 50%;
					filter: brightness(0.5);
					&.west {
						left: 0;
						transform: translate(0, -50%) rotate(-90deg);
					}
					&.east {
						right: 0;
						transform: translate(0, -50%) rotate(90deg);
					}
				}
			}

			svg {
				width: 100%;
				height: 100%;
				border-radius: 100%;
			}

			.point {
				position: absolute;
				top: calc((1 - var(--y)) * 50%);
				left: calc((var(--x) + 1) * 50%);
				background-color: red;
				width: 1em;
				height: 1em;
				border-radius: 100%;
				transform: translate(-50%, -50%);
			}
		}

		button:has(img) {
			font: inherit;
			width: 10cqmax;
			height: 10cqmax;
			position: absolute;
			background-color: #24242c;
			border: none;
			border-radius: 20%;
			margin: 2cqmax;
			transition: background-color 0.2s;

			&:hover {
				background-color: #2c2d4e;
			}

			img {
				width: 60%;
			}
		}
	`;
}

function calculateBearing(origin: Coord, other: Coord) {
	const dlon = other[1] - origin[1];

	const x = Math.sin(dlon) * Math.cos(other[0]);
	const y =
		Math.cos(origin[0]) * Math.sin(other[0]) -
		Math.sin(origin[0]) * Math.cos(other[0]) * Math.cos(dlon);
	const bearing =
		((Math.atan2(x, y) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	return bearing;
}

function distance(first: Coord, second: Coord) {
	const dlat = second[0] - first[0];
	const dlon = second[1] - first[1];

	const a =
		Math.sin(dlat / 2) ** 2 +
		Math.cos(first[0]) * Math.cos(second[0]) * Math.sin(dlon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = EARTH_RADIUS * c; // in meters
	return distance;
}
