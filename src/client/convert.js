const { rgbToHSV } = require('./glov/hsv.js');
let arr = [
  [1, '#ffffff'],
  [2, '#d9ffff'],
  [3, '#cc80ff'],
  [4, '#c2ff00'],
  [5, '#ffb5b5'],
  [6, '#909090'],
  [7, '#3050f8'],
  [8, '#ff0d0d'],
  [9, '#90e050'],
  [10, '#b3e3f5'],
  [11, '#ab5cf2'],
  [12, '#8aff00'],
  [13, '#bfa6a6'],
  [14, '#f0c8a0'],
  [15, '#ff8000'],
  [16, '#ffff30'],
  [17, '#1ff01f'],
  [18, '#80d1e3'],
  [19, '#8f40d4'],
  [20, '#3dff00'],
  [21, '#e6e6e6'],
  [22, '#bfc2c7'],
  [23, '#a6a6ab'],
  [24, '#8a99c7'],
  [25, '#9c7ac7'],
  [26, '#e06633'],
  [27, '#f090a0'],
  [28, '#50d050'],
  [29, '#c88033'],
  [30, '#7d80b0'],
  [31, '#c28f8f'],
  [32, '#668f8f'],
  [33, '#bd80e3'],
  [34, '#ffa100'],
  [35, '#a62929'],
  [36, '#5cb8d1'],
  [37, '#702eb0'],
  [38, '#00ff00'],
  [39, '#94ffff'],
  [40, '#94e0e0'],
  [41, '#73c2c9'],
  [42, '#54b5b5'],
  [43, '#3b9e9e'],
  [44, '#248f8f'],
  [45, '#0a7d8c'],
  [46, '#006985'],
  [47, '#c0c0c0'],
  [48, '#ffd98f'],
  [49, '#a67573'],
  [50, '#668080'],
  [51, '#9e63b5'],
  [52, '#d47a00'],
  [53, '#940094'],
  [54, '#429eb0'],
  [55, '#57178f'],
  [56, '#00c900'],
  [57, '#70d4ff'],
  [58, '#ffffc7'],
  [59, '#d9ffc7'],
  [60, '#c7ffc7'],
  [61, '#a3ffc7'],
  [62, '#8fffc7'],
  [63, '#61ffc7'],
  [64, '#45ffc7'],
  [65, '#30ffc7'],
  [66, '#1fffc7'],
  [67, '#00ff9c'],
  [68, '#00e675'],
  [69, '#00d452'],
  [70, '#00bf38'],
  [71, '#00ab24'],
  [72, '#4dc2ff'],
  [73, '#4da6ff'],
  [74, '#2194d6'],
  [75, '#267dab'],
  [76, '#266696'],
  [77, '#175487'],
  [78, '#d0d0e0'],
  [79, '#ffd123'],
  [80, '#b8b8d0'],
  [81, '#a6544d'],
  [82, '#575961'],
  [83, '#9e4fb5'],
  [84, '#ab5c00'],
  [85, '#754f45'],
  [86, '#428296'],
  [87, '#420066'],
  [88, '#007d00'],
  [89, '#70abfa'],
  [90, '#00baff'],
  [91, '#00a1ff'],
  [92, '#008fff'],
  [93, '#0080ff'],
  [94, '#006bff'],
  [95, '#545cf2'],
  [96, '#785ce3'],
  [97, '#8a4fe3'],
  [98, '#a136d4'],
  [99, '#b31fd4'],
  [100, '#b31fba'],
  [101, '#b30da6'],
  [102, '#bd0d87'],
  [103, '#c70066'],
  [104, '#cc0059'],
  [105, '#d1004f'],
  [106, '#d90045'],
  [107, '#e00038'],
  [108, '#e6002e'],
  [109, '#eb0026'],
  [110, '#ff1493'],
  [111, '#ff1493'],
  [112, '#ff1493'],
  [113, '#ff1493'],
  [114, '#ff1493'],
  [115, '#ff1493'],
  [116, '#ff1493'],
  [117, '#ff1493'],
  [118, '#ff1493'],
];

function fmt(v) {
  let tf = v.toFixed(3);
  let ts = String(v);
  return ts.length < tf.length ? ts : tf;
}

let out = arr.map((a) => {
  let hsv = [0,0,0];
  rgbToHSV(hsv, [a[1].slice(1,3), a[1].slice(3, 5), a[1].slice(5)].map((v) => parseInt(v, 16) / 255));
  return [Math.round(hsv[0]), fmt(hsv[1]), fmt(hsv[2])].join(',');
});
console.log(out.join('\n'));
