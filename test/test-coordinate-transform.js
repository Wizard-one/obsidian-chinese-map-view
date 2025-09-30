// 简单的坐标转换测试
// 基于高德地图坐标转换算法

const a = 6378245.0;
const ee = 0.00669342162296594323;

function outOfChina(lat, lon) {
    if (lon < 72.004 || lon > 137.8347) {
        return true;
    }
    if (lat < 0.8293 || lat > 55.8271) {
        return true;
    }
    return false;
}

function transformLat(x, y) {
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

function transformLon(x, y) {
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

function wgs84ToGcj02(wgLat, wgLon) {
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

function gcj02ToWgs84(gcjLat, gcjLon) {
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

    const wgsLat = gcjLat - dLat;
    const wgsLon = gcjLon - dLon;

    return [wgsLon, wgsLat];
}

// 测试坐标转换
console.log('=== 坐标转换测试 ===');

// 测试北京坐标
const beijingWgs84 = [39.90923, 116.397428];
console.log('\n北京坐标测试:');
console.log('原始 WGS84:', beijingWgs84[0], beijingWgs84[1]);

const beijingGcj02 = wgs84ToGcj02(beijingWgs84[0], beijingWgs84[1]);
console.log('转换到 GCJ02:', beijingGcj02[1], beijingGcj02[0]);

const beijingBackToWgs84 = gcj02ToWgs84(beijingGcj02[1], beijingGcj02[0]);
console.log('转回 WGS84:', beijingBackToWgs84[1], beijingBackToWgs84[0]);

const diffLat = Math.abs(beijingBackToWgs84[1] - beijingWgs84[0]);
const diffLng = Math.abs(beijingBackToWgs84[0] - beijingWgs84[1]);
console.log('误差:', diffLat, diffLng);
console.log(
    '误差(米):',
    diffLat * 111000,
    diffLng * 111000 * Math.cos((beijingWgs84[0] * Math.PI) / 180),
);

// 测试上海坐标
const shanghaiWgs84 = [31.230416, 121.473701];
console.log('\n上海坐标测试:');
console.log('原始 WGS84:', shanghaiWgs84[0], shanghaiWgs84[1]);

const shanghaiGcj02 = wgs84ToGcj02(shanghaiWgs84[0], shanghaiWgs84[1]);
console.log('转换到 GCJ02:', shanghaiGcj02[1], shanghaiGcj02[0]);

const shanghaiBackToWgs84 = gcj02ToWgs84(shanghaiGcj02[1], shanghaiGcj02[0]);
console.log('转回 WGS84:', shanghaiBackToWgs84[1], shanghaiBackToWgs84[0]);

const diffLatSh = Math.abs(shanghaiBackToWgs84[1] - shanghaiWgs84[0]);
const diffLngSh = Math.abs(shanghaiBackToWgs84[0] - shanghaiWgs84[1]);
console.log('误差:', diffLatSh, diffLngSh);
console.log(
    '误差(米):',
    diffLatSh * 111000,
    diffLngSh * 111000 * Math.cos((shanghaiWgs84[0] * Math.PI) / 180),
);

console.log('\n=== 测试完成 ===');
