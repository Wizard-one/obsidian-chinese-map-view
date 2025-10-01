// Test script to verify coordinate transformation for Gaode maps in Open In functionality

const {
    transformCoordinatesForAutoNavi,
} = require('../src/coordinateTransformer.ts');

// Test coordinates for 三潭映月 (Three Pools Mirroring the Moon)
const testLocation = {
    lat: 30.24127801418307,
    lng: 120.140541797848,
};

console.log('Testing coordinate transformation for Gaode maps...');
console.log('Original WGS84 coordinates:', testLocation.lat, testLocation.lng);

// Transform to GCJ02 (Mars coordinates used by Gaode)
const transformedLocation = transformCoordinatesForAutoNavi(testLocation);
console.log(
    'Transformed GCJ02 coordinates:',
    transformedLocation.lat,
    transformedLocation.lng,
);

// Expected result should be slightly different from original
const latDiff = Math.abs(transformedLocation.lat - testLocation.lat);
const lngDiff = Math.abs(transformedLocation.lng - testLocation.lng);

console.log('Coordinate difference:', latDiff, lngDiff);
console.log(
    'Transformation applied:',
    latDiff > 0.0001 || lngDiff > 0.0001 ? 'YES' : 'NO',
);

// Test URL generation
const name = '三潭映月';
const urlPattern = 'https://uri.amap.com/marker?position={y},{x}&name={name}';
const fullUrl = urlPattern
    .replace(/{x}/g, transformedLocation.lat.toString())
    .replace(/{y}/g, transformedLocation.lng.toString())
    .replace(/{name}/g, name);

console.log('Generated Gaode URL:', fullUrl);
