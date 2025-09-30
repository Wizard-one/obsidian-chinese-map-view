import * as leaflet from 'leaflet';
import { type TileSource } from './settings';

// Krasovsky 1940
// a = 6378245.0, 1/f = 298.3
// b = a * (1 - f)
// ee = (a^2 - b^2) / a^2
const a = 6378245.0;
const ee = 0.00669342162296594323;

/**
 * Transform from WGS84 to GCJ-02 (Mars coordinate system used by AutoNavi/Gaode)
 */
function wgs84ToGcj02(wgLat: number, wgLon: number): [number, number] {
    if (outOfChina(wgLat, wgLon)) {
        return [wgLat, wgLon];
    }

    let dLat = transformLat(wgLon - 105.0, wgLat - 35.0);
    let dLon = transformLon(wgLon - 105.0, wgLat - 35.0);
    let radLat = (wgLat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    let sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
    dLon = (dLon * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);
    let mgLat = wgLat + dLat;
    let mgLon = wgLon + dLon;
    return [mgLon, mgLat];
}

function outOfChina(lat: number, lon: number) {
    if (lon < 72.004 || lon > 137.8347) {
        return true;
    }
    if (lat < 0.8293 || lat > 55.8271) {
        return true;
    }
    return false;
}

function transformLat(x: number, y: number) {
    let ret =
        -100.0 +
        2.0 * x +
        3.0 * y +
        0.2 * y * y +
        0.1 * x * y +
        0.2 * Math.sqrt(Math.abs(x));
    ret +=
        ((20.0 * Math.sin(6.0 * x * Math.PI) +
            20.0 * Math.sin(2.0 * x * Math.PI)) *
            2.0) /
        3.0;
    ret +=
        ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) *
            2.0) /
        3.0;
    ret +=
        ((160.0 * Math.sin((y / 12.0) * Math.PI) +
            320 * Math.sin((y * Math.PI) / 30.0)) *
            2.0) /
        3.0;
    return ret;
}

function transformLon(x: number, y: number) {
    let ret =
        300.0 +
        x +
        2.0 * y +
        0.1 * x * x +
        0.1 * x * y +
        0.1 * Math.sqrt(Math.abs(x));
    ret +=
        ((20.0 * Math.sin(6.0 * x * Math.PI) +
            20.0 * Math.sin(2.0 * x * Math.PI)) *
            2.0) /
        3.0;
    ret +=
        ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) *
            2.0) /
        3.0;
    ret +=
        ((150.0 * Math.sin((x / 12.0) * Math.PI) +
            300.0 * Math.sin((x / 30.0) * Math.PI)) *
            2.0) /
        3.0;
    return ret;
}

/**
 * Check if a map source requires coordinate transformation (AutoNavi/Gaode maps)
 */
export function isAutoNaviMapSource(mapSource: TileSource): boolean {
    if (!mapSource) return false;

    const name = mapSource.name?.toLowerCase() || '';
    const urlLight = mapSource.urlLight?.toLowerCase() || '';
    const urlDark = mapSource.urlDark?.toLowerCase() || '';

    return (
        name.includes('高德') ||
        name.includes('autonavi') ||
        name.includes('gaode') ||
        urlLight.includes('autonavi.com') ||
        urlDark.includes('autonavi.com')
    );
}

/**
 * Get the appropriate subdomains for AutoNavi maps
 */
export function getAutoNaviSubdomains(): string[] {
    return ['1', '2', '3', '4'];
}

/**
 * Transform coordinates for AutoNavi maps (WGS84 to GCJ-02)
 */
export function transformCoordinatesForAutoNavi(
    location: leaflet.LatLng,
): leaflet.LatLng {
    const [transformedLng, transformedLat] = wgs84ToGcj02(
        location.lat,
        location.lng,
    );
    return new leaflet.LatLng(transformedLat, transformedLng);
}

/**
 * Transform from GCJ-02 to WGS84 (for saving coordinates from AutoNavi maps)
 * Using more precise reverse transformation algorithm
 */
function gcj02ToWgs84(gcjLat: number, gcjLon: number): [number, number] {
    if (outOfChina(gcjLat, gcjLon)) {
        return [gcjLat, gcjLon];
    }

    let dLat = transformLat(gcjLon - 105.0, gcjLat - 35.0);
    let dLon = transformLon(gcjLon - 105.0, gcjLat - 35.0);
    let radLat = (gcjLat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    let sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
    dLon = (dLon * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);

    // More precise reverse transformation: WGS84 = GCJ02 - delta
    const wgsLat = gcjLat - dLat;
    const wgsLon = gcjLon - dLon;

    return [wgsLon, wgsLat];
}

/**
 * Transform coordinates from AutoNavi maps (GCJ-02 to WGS84) for saving
 */
export function transformCoordinatesFromAutoNavi(
    location: leaflet.LatLng,
): leaflet.LatLng {
    const [transformedLng, transformedLat] = gcj02ToWgs84(
        location.lat,
        location.lng,
    );
    return new leaflet.LatLng(transformedLat, transformedLng);
}

/**
 * Test function to verify coordinate transformation accuracy
 * Beijing coordinates: WGS84 (116.397428, 39.90923) -> GCJ02 (116.404, 39.915)
 */
export function testCoordinateTransformation(): void {
    // Test Beijing coordinates
    const wgs84Beijing = new leaflet.LatLng(39.90923, 116.397428);
    const gcj02Beijing = transformCoordinatesForAutoNavi(wgs84Beijing);
    const backToWgs84 = transformCoordinatesFromAutoNavi(gcj02Beijing);

    console.log('Coordinate transformation test:');
    console.log('Original WGS84:', wgs84Beijing.lat, wgs84Beijing.lng);
    console.log('Converted to GCJ02:', gcj02Beijing.lat, gcj02Beijing.lng);
    console.log('Back to WGS84:', backToWgs84.lat, backToWgs84.lng);
    console.log(
        'Difference:',
        Math.abs(backToWgs84.lat - wgs84Beijing.lat),
        Math.abs(backToWgs84.lng - wgs84Beijing.lng),
    );

    // Test Shanghai coordinates
    const wgs84Shanghai = new leaflet.LatLng(31.230416, 121.473701);
    const gcj02Shanghai = transformCoordinatesForAutoNavi(wgs84Shanghai);
    const backToWgs84Shanghai = transformCoordinatesFromAutoNavi(gcj02Shanghai);

    console.log('\nShanghai test:');
    console.log('Original WGS84:', wgs84Shanghai.lat, wgs84Shanghai.lng);
    console.log('Converted to GCJ02:', gcj02Shanghai.lat, gcj02Shanghai.lng);
    console.log(
        'Back to WGS84:',
        backToWgs84Shanghai.lat,
        backToWgs84Shanghai.lng,
    );
    console.log(
        'Difference:',
        Math.abs(backToWgs84Shanghai.lat - wgs84Shanghai.lat),
        Math.abs(backToWgs84Shanghai.lng - wgs84Shanghai.lng),
    );
}
