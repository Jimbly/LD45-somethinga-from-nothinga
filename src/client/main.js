/*eslint global-require:off, no-bitwise:off */

const glov_local_storage = require('./glov/local_storage.js');
glov_local_storage.storage_prefix = 'LD43';

const assert = require('assert');
const animation = require('./glov/animation.js');
const engine = require('./glov/engine.js');
const camera2d = require('./glov/camera2d.js');
const glov_font = require('./glov/font.js');
const { hsvToRGB } = require('./glov/hsv.js');
const input = require('./glov/input.js');
//const glov_particles = require('./glov/particles.js');
const score_system = require('./glov/score.js');
const glov_sprites = require('./glov/sprites.js');
//const glov_sprite_animation = require('./glov/sprite_animation.js');
const glov_transition = require('./glov/transition.js');
const periodic = require('./periodic.js');
const pico8 = require('./glov/pico8.js');
const ui = require('./glov/ui.js');
const { abs, floor, max, min, sin } = Math;

const { vec2, vec4, v4copy } = require('./glov/vmath.js');

const DEBUG = window.location.host.indexOf('localhost') !== -1;

window.Z = window.Z || {};
Z.BACKGROUND = 0;
Z.SPRITES = 10;
Z.PARTICLES = 20;
Z.TITLES = 200;

const SIDE_WIDTH_OPEN = 400;
const SIDE_WIDTH_CLOSED = 52;
const BOARD_W = 600;
const GAME_WIDTH_SIDE = BOARD_W + SIDE_WIDTH_OPEN;
// const GAME_WIDTH_CLOSED = BOARD_W + SIDE_WIDTH_CLOSED;
// let app = exports;
// Virtual viewport for our game logic
const GAME_HEIGHT_DEFAULT = 900;
let last_frame_height = 205;
const side_height = 900;

export let sprites = {};

const color_white = vec4(1, 1, 1, 1);
const color_black = vec4(0, 0, 0, 1);

export function main() {
  if (!engine.startup({
    do_borders: false,
    game_width: GAME_WIDTH_SIDE, // Just used for modal dialog scaling
    game_height: GAME_HEIGHT_DEFAULT, // Just used for modal dialog scaling
    pixely: 'off',
    viewport_postprocess: false,
    sound_manager: require('./glov/sound_manager.js').create({
      auto_mp3s: true,
      music_on: !DEBUG,
    }),
    show_fps: false,
    antialias: true,
    ui_sprites: {
      button: ['ui.local/button', [2,60,2], [64]],
      button_rollover: ['ui.local/button_rollover', [2,60,2], [64]],
      button_down: ['ui.local/button_down', [2,60,2], [64]],
      button_disabled: ['ui.local/button_disabled', [2,60,2], [64]],
      panel: ['ui.local/panel', [2,60,2], [2,60,2]],
    },
    ui_sounds: {
      button_click: [
        'click1', 'click2', 'click3', 'click4', 'click5', 'click6', 'click7', 'click8', 'click9', 'click10'
      ],
      fanfare: 'fanfare',
      fanfare_mini: ['fanfare_mini1', 'fanfare_mini2'],
    },
    // font: {
    //   info: require('./img/font/oswald32.json'),
    //   texture: 'font/oswald32',
    // },
  })) {
    return;
  }
  v4copy(ui.color_panel, pico8.colors[7]);
  let font_periodic = glov_font.create(require('./img/font/oswald56.json'), 'font/oswald56');
  let font_shadows = glov_font.create(require('./img/font/shadows32.json'), 'font/shadows32');

  gl.clearColor(0.1, 0.1, 0.1, 1);

  const font = engine.font;

  const sound_manager = engine.sound_manager;
  // const font = engine.font;

  // Perfect sizes for pixely modes
  //ui.scaleSizes(13 / 32);
  //ui.setFontHeight(8);

  const createSprite = glov_sprites.create;

  function initGraphics() {

    sound_manager.loadSound('rollover');

    sprites.white = createSprite({ url: 'white' });
    sprites.pipes = createSprite({ name: 'pipes', layers: 2, ws: [128, 128, 128, 128], hs: [256] });

    sprites.game_bg = createSprite({
      url: 'white',
      size: vec2(1, 1),
    });
  }

  const LEFT = 1;
  const RIGHT = 2;
  // const SPLIT = 3;
  const OUTPUT = 4;

  function stringToElems(str) {
    let ret = [];
    for (let ii = 0; ii < str.length; ++ii) {
      let ch = str[ii];
      if (ii < str.length - 1 && str[ii + 1].toLowerCase() === str[ii + 1]) {
        ii++;
        ch += str[ii];
      }
      let elem = periodic.inv[ch];
      assert(elem);
      ret.push(elem);
    }
    return ret;
  }

  let level = 0;
  let levels = [
    {
      name: 'tut1',
      display_name: 'Tutorial 1/4: fusion',
      source: 'NO',
      goal: 'P',
      max_score: [null, 1, null],
    },
    {
      name: 'tut2',
      display_name: 'Tutorial 2/4: fission, waste',
      hint: 'Hint: Sometimes, not all of the input needs to be used to get the desired output.\n\n' +
        'Also note, an element needs a clear path to the bottom to be counted as an output.',
      source: 'As', // 33
      goal: 'HHO', // 10
      max_score: [null, 0, null],
    },
    { // easy, but exact
      name: '1jp',
      display_name: 'Japanese',
      hint: '無 (Japanese "Mu") (noun): nothing; nothingness',
      source: 'MoO', // 50
      goal: 'NaY', // 50
    },
    {
      name: 'tut3',
      display_name: 'Tutorial 3/4: fission, parity',
      hint: 'Hint: When dividing an odd element the larger element alternates flowing right or left at each row.\n\n' +
        'Also note, outputs need to be provided in order.',
      source: 'Li', // 3
      goal: 'HeH', // 3
      max_score: [null,0,1],
    },
    { // my score: 6/3/7; easy
      name: '2cn',
      display_name: 'Chinese',
      hint: '莫 (Ancient Chinese "Mò") (noun): nothing; no one',
      source: 'Mo', // 42
      goal: 'SiNO', // 29
    },
    { // my score: 6/6/6
      name: 'tut4',
      display_name: 'Tutorial 4/4: "reality"',
      hint: 'Hint: You cannot invent new elements, that might be dangerous',
      source: 'WPd', // 120
      goal: 'NdNd', // 120
    },
    { // my score 5/6/8
      name: '4lt',
      display_name: 'Latvian',
      hint: '"Neko" (Latvian) (noun): nothing',
      source: 'NeKO',
      goal: 'LiONS',
    },
    { // my score: 7/7/11; medium
      name: '5ct',
      display_name: 'Catalan',
      hint: '"Res" (Catalan) (adverb): nothing',
      source: 'ReS', // 91
      goal: 'ArTiSTiC', // 84
    },
    { // 10/12/16 medium-low
      name: '6ir',
      display_name: 'Irish',
      hint: '"Neamhní" (Irish) (noun): nothing',
      source: 'NeAmHNI', // 166
      goal: 'IrISH', // 147
    },
    { // my score: 8/7/10; low-medium
      name: '7wt',
      display_name: 'WTFBBQ',
      source: 'WThF', // 173
      goal: 'BaBaCu', // 141
    },
    { // my score: 10/9/15; medium
      name: '8de',
      display_name: 'German',
      hint: '"Nichts" (German) (noun): a quantity of no importance; nothing',
      source: 'NiCHTs', // 152
      goal: 'NIXe', // 114
      // goal: 'HOH', // 10
    },
    { // my score: 11/12/18; trickyish
      name: '9ep',
      display_name: 'Esperanto',
      hint: '"Nenio" (Esperanto) (noun): nothing',
      source: 'NeNIO', // 78
      goal: 'AlCoHOLiCS', // 74
    },
    // {
    //   name: 'ld',
    //   display_name: 'It\s the thought that counts',
    //   source: 'LuDbUMdArRe',
    //   goal: 'GaMdEuV',
    // },
    { // 11/16/22
      name: '10ti',
      display_name: 'SOMtHINGa from NoThINGa',
      hint: '"Nothing" (noun): something that does not exist',
      source: 'NoThINGa', // 283
      goal: 'SOMtHINGa', // 225
    },
    {
      name: '11fin',
      display_name: 'The End?',
      hint: 'Thanks for playing!',
      source: 'NoThInGe',
      goal: 'FIN',
    },
    // Probably not possible at our limited width/height
    {
      name: 'bonus',
      display_name: 'Bonus Level: Worst Case Scenario',
      hint: 'Hint: 513 - 456 = 57\n\nI\'m not completely sure this level is possible, but my program told me' +
        ' that these two particular words were among the top 10 words in the English language ordered by atomic' +
        ' weight so I couldn\'t resist.',
      source: 'SUPErFlUOUS', // 513
      goal: 'CaPrICIOUSnEsS', // 456
    },
  ];
  for (let ii = 0; ii < levels.length; ++ii) {
    let source = 0;
    stringToElems(levels[ii].source).filter((a) => (source += a));
    let goal = 0;
    stringToElems(levels[ii].goal).filter((a) => (goal += a));
    // console.log(levels[ii].source, source, levels[ii].goal, goal);
    assert(source >= goal);
  }

  function encodeScore(score) {
    assert(score.height && (score.fu || score.fi));
    return (999 - score.height) * 1000 * 1000 +
      (999 - score.fu) * 1000 +
      (999 - score.fi);
  }

  function parseScore(value) {
    let height = floor(value / (1000 * 1000));
    value -= height * 1000 * 1000;
    let fu = floor(value / 1000);
    value -= fu * 1000;
    let fi = value;
    return {
      height: 999 - height,
      fu: 999 - fu,
      fi: 999 - fi,
    };
  }

  score_system.init(encodeScore, parseScore, levels, 'LD45');

  function GameState() {
    this.last_best_score = -1;
    this.level = level;
    let level_def = levels[level];
    this.w = 12;
    this.h = 32;
    this.ever_complete = false;
    this.last_complete = false;
    this.board = new Array(this.h);
    for (let ii = 0; ii < this.board.length; ++ii) {
      this.board[ii] = new Array(this.w);
      for (let jj = 0; jj < this.board[ii].length; ++jj) {
        this.board[ii][jj] = { v: 0, state: 0, pos: [ii, jj], rgb: vec4(1,1,1,1) };
      }
    }
    let source_elem = stringToElems(level_def.source);
    let mult = 2 + (source_elem.length - 1) * 2 >= this.w ? 1 : 2;
    let padding = this.w - ((source_elem.length - 1) * mult + 1);
    let base = floor(padding / 2);
    for (let ii = 0; ii < source_elem.length; ++ii) {
      let elem = this.board[0][base + ii * mult];
      elem.v = source_elem[ii];
      elem.hsv = periodic[source_elem[ii]][2];
      hsvToRGB(elem.rgb, elem.hsv[0], elem.hsv[1], elem.hsv[2]);
    }
    this.edges = new Array(this.h - 1);
    for (let ii = 0; ii < this.edges.length; ++ii) {
      this.edges[ii] = new Array(this.w * 2 - 1);
      for (let jj = 0; jj < this.edges[ii].length; ++jj) {
        this.edges[ii][jj] = 0;
      }
    }
    this.goal = stringToElems(level_def.goal);

    if (DEBUG) {
      // this.edges[0][11] =
      // this.edges[0][14] =
      // this.edges[0][15] =
      // this.edges[1][12] =
      // this.edges[1][15] = 1;
    }
  }

  GameState.prototype.addTo = function (elem, v, hsv) {
    if (elem.v) {
      this.num_join++;
      let he = elem.hsv[0];
      let hs = hsv[0];
      if (max(hs, he) - min(hs, he) > 180) {
        if (hs > he) {
          hs -= 360;
        } else {
          he -= 360;
        }
      }
      let ht = (he * elem.v + hs * v) / (elem.v + v);
      if (ht < 0) {
        ht += 360;
      }
      if (!elem.hsv[1]) {
        ht = hsv[0];
      } else if (!hsv[1]) {
        ht = elem.hsv[0];
      }
      elem.hsv[0] = ht;
      elem.hsv[1] = (elem.hsv[1] * elem.v + hsv[1] * v) / (elem.v + v);
      elem.hsv[2] = (elem.hsv[2] * elem.v + hsv[2] * v) / (elem.v + v);
    } else {
      elem.hsv = hsv.slice(0);
    }
    elem.v += v;
    hsvToRGB(elem.rgb, elem.hsv[0], elem.hsv[1], elem.hsv[2]);
  };

  GameState.prototype.update = function () {
    // Clear
    this.num_split = 0;
    this.num_join = 0;
    for (let ii = 1; ii < this.board.length; ++ii) {
      let row = this.board[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        row[jj].v = 0;
        row[jj].state = 0;
      }
    }
    // Distribute
    let tallest = 0;
    for (let ii = 0; ii < this.board.length - 1; ++ii) {
      let row = this.board[ii];
      let next = this.board[ii + 1];
      let edges = this.edges[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        let v = row[jj].v;
        if (!v || v >= periodic.length) {
          continue;
        }
        let hsv = row[jj].hsv;
        let p1 = jj;
        let e1 = edges[jj * 2] || 0;
        let p2;
        let e2;
        if (ii & 1) {
          e2 = edges[jj * 2 - 1] || 0;
          p2 = jj - 1;
          row[jj].state = e2 * LEFT + e1 * RIGHT;
        } else {
          e2 = edges[jj * 2 + 1] || 0;
          p2 = jj + 1;
          row[jj].state = e1 * LEFT + e2 * RIGHT;
        }
        if (e1 && e2) {
          // split
          this.num_split++;
          let v1 = floor(v / 2);
          let v2 = v - v1;
          this.addTo(next[p1], v1, hsv);
          this.addTo(next[p2], v2, hsv);
          tallest = ii + 1;
        } else if (e1) {
          tallest = ii + 1;
          this.addTo(next[p1], v, hsv);
        } else if (e2) {
          tallest = ii + 1;
          this.addTo(next[p2], v, hsv);
        }
      }
      if (tallest !== ii + 1) {
        break;
      }
    }
    this.active_height = tallest;
    let last_row = this.board[tallest];
    let last_outputs = last_row.slice(0);
    // for any empty slot, put down the above sink
    for (let ii = 0; ii < last_outputs.length; ++ii) {
      if (last_outputs[ii].v) {
        last_outputs[ii].state = OUTPUT;
      } else {
        for (let jj = tallest - 1; jj >= 0; --jj) {
          let node = this.board[jj][ii];
          if (node.v) {
            if (node.v && !node.state) {
              node.state = OUTPUT;
              last_outputs[ii] = node;
            }
            break;
          }
        }
      }
    }
    last_outputs = last_outputs.filter((a) => a.v);
    let goal_state = new Array(this.goal.length);
    let best_score = -1;
    let best = [];
    let goal = this.goal;
    function solve(goal_idx, output_idx, score) {
      if (goal_idx === goal.length || output_idx === last_outputs.length) {
        if (score > best_score) {
          best_score = score;
          best = goal_state.slice(0);
        }
        return;
      }
      for (let ii = output_idx; ii < last_outputs.length; ++ii) {
        if (last_outputs[ii].v === goal[goal_idx]) {
          goal_state[goal_idx] = last_outputs[ii];
          solve(goal_idx + 1, ii + 1, score + 1);
          break;
        }
      }
      goal_state[goal_idx] = null;
      solve(goal_idx + 1, output_idx, score);
    }
    solve(0, 0, 0);
    this.goal_state = best;
    if (best_score >= this.goal.length / 2) {
      sound_manager.playMusic('bgm', 1, true);
    } else if (best_score) {
      sound_manager.playMusic('bgm_light', 1, true);
    } else {
      sound_manager.playMusic('bgm_superlight', 1, true);
    }
    if (this.last_best_score !== -1 && best_score > this.last_best_score) {
      ui.playUISound('fanfare_mini');
    }
    this.last_best_score = best_score;
  };

  let transition_anim;
  let transition_up;
  function endTransition() {
    transition_anim = null;
    transition_up = false;
    glov_transition.queue(glov_transition.IMMEDIATE, glov_transition.fade(1000));
  }
  let title_fade1;
  let title_fade2;
  let hint_fade;
  let click_fade;
  let style_title = glov_font.style(null, { color: 0xFFFFFFff });
  let style_title_click = glov_font.style(null, { color: 0x808080ff });
  const trans_width = 652;
  const trans_height = 900;
  function showTransition() {
    camera2d.setAspectFixed(trans_width, trans_height);
    sprites.white.draw({
      x: camera2d.x0(), y: camera2d.y0(), z: Z.TITLES,
      w: camera2d.w(), h: camera2d.h(),
      color: color_black,
    });

    let z = Z.TITLES + 1;
    let size = 64;
    let pad = 8;
    let level_data = levels[level];
    let y = 100;
    font_periodic.drawSizedAligned(glov_font.styleAlpha(style_title_click, title_fade1),
      0, y, z, size * 0.75, glov_font.ALIGN.HCENTERFIT, trans_width, 0,
      `Level ${level+1}/${levels.length - 1}`);
    y += size + pad;
    font_shadows.drawSizedAligned(glov_font.styleAlpha(style_title, title_fade2),
      0, y, z, size, glov_font.ALIGN.HCENTERFIT, trans_width, 0,
      level_data.display_name);
    y += size + pad;

    y += size;

    size /= 2;
    if (level_data.hint && hint_fade) {
      y += font.drawSizedWrapped(glov_font.styleAlpha(style_title, hint_fade),
        100, y, z, trans_width - 200, 50, size,
        level_data.hint);

      y += size;

      if (level === 1) {
        // first with hint
        font.drawSizedAligned(glov_font.styleAlpha(style_title_click, click_fade),
          0, y, z, size, glov_font.ALIGN.HCENTERFIT, trans_width, 0,
          '(You can read hints again in the right panel)');
      }
    }

    if (click_fade) {
      font.drawSizedAligned(glov_font.styleAlpha(style_title_click, click_fade),
        0, trans_height - 100, z, size, glov_font.ALIGN.HCENTERFIT, trans_width, 0,
        `(${input.touch_mode ? 'tap' : 'click'} to continue)`);
    }

    if (input.click()) {
      ui.playUISound('button_click');
      if (level_data.hint && hint_fade < 1 || title_fade2 < 1) {
        title_fade1 = title_fade2 = hint_fade = click_fade = 1;
      } else {
        endTransition();
      }
    }
  }

  let last_goal_y = 0;
  let state;
  function reset(save_old) {
    //last_goal_y = 0;
    if (save_old) {
      levels[state.level].saved = state;
      if (levels[level].saved) {
        state = levels[level].saved;
        state.update();
        return;
      }
    }
    state = new GameState(level);
    state.update();
    if (!levels[level].did_transition && !DEBUG) {
      levels[level].did_transition = true;
      transition_anim = animation.create();
      transition_up = true;
      glov_transition.queue(glov_transition.IMMEDIATE, glov_transition.fade(100));
      title_fade1 = title_fade2 = hint_fade = click_fade = 0;
      transition_anim.add(0, 1100, (progress) => (title_fade1 = max(title_fade1, progress)));
      // An eslint bug, I guess
      // eslint-disable-next-line no-unused-vars
      let t = transition_anim.add(400, 1100, (progress) => (title_fade2 = max(title_fade2, progress)));
      if (levels[level].hint) {
        t = transition_anim.add(t - 400, 1000, (progress) => (hint_fade = max(hint_fade, progress)));
        t = transition_anim.add(t, 1000, (progress) => progress);
      }
      t = transition_anim.add(t, 500, (progress) => (click_fade = max(click_fade, progress)));
    }
  }
  reset();
  score_system.updateHighScores();

  let style_goal_good = glov_font.styleColored(null, pico8.font_colors[11]);
  let color_goal_good = pico8.colors[11];
  let style_goal_bad = glov_font.styleColored(null, pico8.font_colors[8]);
  let color_goal_bad = pico8.colors[8];
  let style_intermediate = glov_font.styleColored(null, pico8.font_colors[5]);
  let color_intermediate = pico8.colors[5];
  let style_output = glov_font.styleColored(null, 0xFFFFFFff);
  let color_output = vec4(1,1,1, 1);
  let style_dead_end = glov_font.styleColored(null, 0xFFFFFFff);
  let color_dead_end = vec4(1,1,1, 1);
  let style_max = glov_font.styleColored(null, pico8.font_colors[9]);
  let color_max = pico8.colors[9];

  let colors_good = ui.makeColorSet(color_goal_good);
  let score_style = glov_font.styleColored(null, 0x000000ff);
  let score_header_style = glov_font.styleColored(null, 0x333333ff);
  let score_style_def = glov_font.styleColored(null, 0x171717ff);

  let scores_edit_box;
  function showHighScores(x, y) {
    let z = Z.UI + 10;
    let size = 16;
    let width = camera2d.x1() - x - 5;
    font_periodic.drawSizedAligned(score_style, x, y, z, size * 2, glov_font.ALIGN.HCENTERFIT, width, 0,
      `High Scores (Level ${level+1})`);
    y += size * 2 + 2;
    let scores = score_system.high_scores[levels[level].name];
    if (!scores) {
      font.drawSizedAligned(score_style, x, y, z, size, glov_font.ALIGN.HCENTERFIT, width, 0,
        'Loading...');
      return; // still loading
    }
    let widths = [8, 40, 15, 24, 20];
    let widths_total = 0;
    for (let ii = 0; ii < widths.length; ++ii) {
      widths_total += widths[ii];
    }
    let set_pad = size / 2;
    for (let ii = 0; ii < widths.length; ++ii) {
      widths[ii] *= (width - set_pad * (widths.length - 1)) / widths_total;
    }
    let align = [
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HRIGHT,
      glov_font.ALIGN.HFIT,
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HCENTER,
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HCENTER,
      glov_font.ALIGN.HFIT | glov_font.ALIGN.HCENTER,
    ];
    function drawSet(arr, style) {
      let xx = x;
      for (let ii = 0; ii < arr.length; ++ii) {
        font.drawSizedAligned(style, xx, y, z, size, align[ii], widths[ii], 0, String(arr[ii]));
        xx += widths[ii] + set_pad;
      }
      y += size;
    }
    drawSet(['', 'Name', 'Height', 'Fusions', 'Fissions'], score_header_style);
    y += 4;
    let found_me = false;
    for (let ii = 0; ii < scores.length; ++ii) {
      let s = scores[ii];
      let style = score_style_def;
      let drawme = false;
      if (s.name === score_system.player_name) {
        style = glov_font.styleColored(null, pico8.font_colors[3]);
        found_me = true;
        drawme = true;
      }
      if (ii < 20 || drawme) {
        drawSet([`#${ii+1}`, score_system.formatName(s), s.score.height, s.score.fu, s.score.fi], style);
      }
    }
    y += set_pad;
    if (found_me && score_system.player_name.indexOf('Anonymous') === 0) {
      if (!scores_edit_box) {
        scores_edit_box = ui.createEditBox({
          z,
          w: (width - size) * 0.6,
        });
        scores_edit_box.setText(score_system.player_name);
      }

      if (!transition_up && scores_edit_box.run({
        x,
        y,
      }) === scores_edit_box.SUBMIT || ui.buttonText({
        x: x + scores_edit_box.w + size,
        y: y - size * 0.25,
        z,
        w: (width - size) * 0.4,
        h: ui.button_height,
        font_height: ui.font_height * 0.75,
        text: 'Update Player Name'
      })) {
        // scores_edit_box.text
        if (scores_edit_box.text) {
          score_system.updatePlayerName(scores_edit_box.text);
        }
      }
      y += size;
    }
  }

  let did_long_complete;
  function test(dt) {
    if (transition_up) {
      if (transition_anim && !transition_anim.update(dt)) {
        transition_anim = null;
      }
      showTransition();
      input.eatAllInput();
    }

    const side_visible = !engine.defines.SHIDE;

    // Calculate camera that will be used for side
    let side_width = side_visible ? SIDE_WIDTH_OPEN : SIDE_WIDTH_CLOSED;
    camera2d.setAspectFixed(side_width + BOARD_W, side_height);
    let side_percentage = side_width / camera2d.w();
    let side_width_engine = engine.width * side_percentage;
    let board_avail_w = engine.width - side_width_engine;
    let board_avail_h = engine.height;
    let board_need_w = BOARD_W;
    let board_need_h = last_frame_height;
    if (board_avail_w / board_avail_h > board_need_w / board_need_h) {
      // need to be skinny
      let board_width_engine = board_need_w / board_need_h * engine.height;
      let pad_engine = (board_avail_w - board_width_engine) / 2;
      let engine_to_board = BOARD_W / board_width_engine;
      let game_height = board_need_h;
      camera2d.set(-pad_engine * engine_to_board, 0,
        BOARD_W + pad_engine * engine_to_board + side_width_engine * engine_to_board, game_height);
    } else {
      // can fit width
      let game_width = board_need_w / (1 - side_percentage);
      let game_height = board_need_h;
      camera2d.setAspectFixed(game_width, game_height);
    }

    const HSPACE = (BOARD_W - 24) / state.w;
    const CELL_H = ui.font_height;
    const EDGE_H = ui.font_height;
    // const BUTTON_W = (HSPACE - 4) / 2;
    const BUTTON_IMG_W = HSPACE / 2;
    const RECT_BORDER = 2;
    const RECT_HW = HSPACE * 0.5;
    let x0 = RECT_HW;
    let x;
    let y = 10;
    let z = Z.UI;
    let selected_elem = 0;
    function elementFull(v, style, color) {
      font_periodic.drawSizedAligned(style, x, y + CELL_H * 0.125, z, ui.font_height * 1.25,
        glov_font.ALIGN.HCENTER, 0, 0, periodic[v] ? periodic[v][0] : '!!!!');
      ui.drawRect(x - RECT_HW, y, x + RECT_HW, y + CELL_H * 2, z - 2, color || color_white);
      ui.drawRect(x - RECT_HW + RECT_BORDER, y + RECT_BORDER,
        x + RECT_HW - RECT_BORDER, y + CELL_H * 2 - RECT_BORDER, z - 1, color_black);
      font_periodic.drawSizedAligned(style, x - RECT_HW + RECT_BORDER, y + CELL_H * 1.25, z, ui.font_height * 0.75,
        glov_font.ALIGN.HRIGHT, RECT_HW * 2 - RECT_BORDER * 2, 0, `${v}`);
      if (input.mouseOver({
        x: x - RECT_HW,
        y,
        w: HSPACE,
        h: CELL_H * 2,
        peek: true,
      })) {
        selected_elem = v;
      }
    }
    elementFull.height = CELL_H * 2;
    const SMALL_HW = HSPACE * 0.45;
    function elementSmall(v, style, color) {
      let bg_style = glov_font.styleAlpha(style, 0.5);
      bg_style = glov_font.style(bg_style, {
        outline_width: 1.0,
        outline_color: bg_style.color
      });
      font_periodic.drawSizedAligned(bg_style, x - SMALL_HW + RECT_BORDER - 4, y, z, ui.font_height,
        glov_font.ALIGN.HCENTER,
        SMALL_HW * 2 - RECT_BORDER * 2, 0, `${periodic[v] ? periodic[v][0] : '!!!!'}`);
      ui.drawRect(x - SMALL_HW, y, x + SMALL_HW, y + CELL_H, z - 2, color || color_white);
      ui.drawRect(x - SMALL_HW + RECT_BORDER, y + RECT_BORDER,
        x + SMALL_HW - RECT_BORDER, y + CELL_H - RECT_BORDER, z - 1, color_black);
      let fg_style = glov_font.style(style, {
        outline_width: 1,
        outline_color: 0x00000080,
      });
      font_periodic.drawSizedAligned(fg_style, x - SMALL_HW + RECT_BORDER, y, z + 0.1, ui.font_height * 0.75,
        glov_font.ALIGN.HRIGHT | glov_font.ALIGN.VBOTTOM, SMALL_HW * 2 - RECT_BORDER * 2, CELL_H, String(v));
    }
    elementSmall.height = CELL_H;
    function numberSmall(v, style, color) {
      ui.drawRect(x - SMALL_HW, y, x + SMALL_HW, y + CELL_H, z - 2, color || color_white);
      ui.drawRect(x - SMALL_HW + RECT_BORDER, y + RECT_BORDER,
        x + SMALL_HW - RECT_BORDER, y + CELL_H - RECT_BORDER, z - 1, color_black);
      font_periodic.drawSizedAligned(style, x - SMALL_HW + RECT_BORDER, y, z + 0.1, ui.font_height,
        glov_font.ALIGN.HCENTER | glov_font.ALIGN.VCENTER, SMALL_HW * 2 - RECT_BORDER * 2, CELL_H, String(v));
    }
    numberSmall.height = CELL_H;
    for (let ii = 0; ii <= state.active_height; ++ii) {
      let row = state.board[ii];
      x = x0 + (!(ii & 1) ? HSPACE / 2 : 0);
      let mode = ii === 0 ? elementFull : elementSmall;
      for (let jj = 0; jj < row.length; ++jj) {
        let v = row[jj].v;
        if (v) {
          if (v >= periodic.length) {
            mode(v, style_max, color_max);
          } else if (!row[jj].state) {
            mode(v, style_dead_end, color_dead_end);
          } else if (row[jj].state === OUTPUT) {
            let solution = state.goal_state.filter((a) => a === row[jj]).length > 0;
            if (solution) {
              mode(v, style_goal_good, color_goal_good);
            } else {
              mode(v, style_output, color_output);
            }
          } else {
            mode(v, style_intermediate, color_intermediate);
          }
        }
        x += HSPACE;
      }
      y += mode.height;
      let erow = state.edges[ii];
      if (erow) {
        x = x0 + HSPACE / 4;
        for (let jj = 0; jj < erow.length; ++jj) {
          let parent = (ii & 1) ? floor((jj + 1) / 2) : floor(jj / 2);
          let parent_elem = state.board[ii][parent];
          let parent_v = parent_elem && parent_elem.v;
          if (parent_v && parent_v < periodic.length) {
            let right = Boolean((jj + ii) & 1);
            // let text = erow[jj] ? right ? '\\' : '/' : '-';
            // if (ui.buttonText({
            //   x: x - BUTTON_W / 2, y, z, w: BUTTON_W, h: EDGE_H, text
            if (ui.buttonImage({
              x: x - BUTTON_IMG_W / 2, y: y - EDGE_H, z: Z.UI - 5, w: BUTTON_IMG_W, h: EDGE_H * 2,
              img: sprites.pipes,
              shrink: 1,
              frame: erow[jj] ? right ? 2 : 3 : right ? 0 : 1,
              colors: {
                down: [0,0,0,1],
                rollover: [1,1,1,1],
                regular: [0.2,0.2,0.2,1],
              },
              color: erow[jj] ? parent_elem.rgb : pico8.colors[6],
              color1: [1,1,1,1],
              // no_bg: true,
            })) {
              erow[jj] = 1 - erow[jj];
              state.update();
            }
            if (ui.button_mouseover) {
              selected_elem = parent_v;
            }
          }
          // x += (HSPACE - 4) / 2;
          // if ((jj + ii) & 1) {
          //   x += 4;
          // }
          x += BUTTON_IMG_W;
        }
        y += EDGE_H;
      }
    }

    // Show goal
    y += 20;
    if (state.active_height < state.h - 2) {
      y += 45;
    } else if (state.active_height < state.h - 1) {
      y += CELL_H;
    }
    let goal_y = y;
    if (!last_goal_y || abs(goal_y - last_goal_y) < 0.01) {
      last_goal_y = goal_y;
    } else {
      let delta = (goal_y - last_goal_y) * engine.this_frame_time * 0.01;
      last_goal_y += delta;
      goal_y = last_goal_y;
    }
    y = goal_y;
    x = 30;
    font_periodic.drawSizedAligned(null, x, y, z, ui.font_height,
      glov_font.ALIGN.HVCENTER, 0, elementFull.height, 'Goal:');
    x += HSPACE + 10;
    let complete = true;
    for (let ii = 0; ii < state.goal.length; ++ii) {
      let v = state.goal[ii];
      let gs = state.goal_state[ii];
      if (!gs) {
        complete = false;
      }
      let color = gs ? color_goal_good : color_goal_bad;
      let style = gs ? style_goal_good : style_goal_bad;
      elementFull(v, style, color);
      x += HSPACE + ((state.goal.length > 9) ? 4 : 10);
    }
    y += elementFull.height + 10;

    last_frame_height = y;

    if (DEBUG && false) {
      sprites.game_bg.draw({
        x: 0, y: 0, z: Z.BACKGROUND,
        w: board_need_w, h: last_frame_height,
        color: [0.2, 0.2, 0.2, 1]
      });
    }

    // draw side UI
    camera2d.setAspectFixed(side_width + BOARD_W, side_height);
    let x1 = camera2d.x1();
    x = x1 - side_width;
    y = 0;
    sprites.game_bg.draw({
      x, y: camera2d.y0(), z: Z.BACKGROUND,
      w: side_width, h: camera2d.h(),
      color: pico8.colors[7]
    });

    if (ui.buttonText({
      x: x1 - ui.button_height - 10, y: camera2d.y0() + 10,
      w: ui.button_height,
      text: engine.defines.SHIDE ? '«' : '»',
    })) {
      engine.defines.SHIDE = !engine.defines.SHIDE;
    }

    x0 = x1 - side_width + (side_visible ? 10 : 5);
    y += side_visible ? 10 : 20;
    x = x0;

    y += ui.button_height;
    x = x0;
    let score_style_bad = glov_font.styleAlpha(glov_font.style(null, {
      color: pico8.font_colors[8],
    }), abs(sin(engine.global_timer * 0.01)));
    let score_style_bad_static = glov_font.style(null, {
      color: pico8.font_colors[8], // 0x800000ff,
    });
    let hint_style = glov_font.style(null, {
      color: 0x202020ff,
    });

    font_periodic.drawSizedAligned(
      side_visible ? glov_font.styleColored(score_style, pico8.font_colors[5]) : score_style,
      x, y, z,
      ui.font_height * 0.8,
      side_visible ? glov_font.ALIGN.HCENTER : glov_font.ALIGN.HFIT,
      x1 - x - 5, 0,
      `${side_visible ? 'Level ' : ''}${level+1}/${levels.length - 1}`);
    y += ui.font_height;
    let level_data = levels[level];
    if (side_visible) {
      font_periodic.drawSizedAligned(score_style, x, y, z, ui.font_height * 1.35,
        side_visible ? glov_font.ALIGN.HCENTER : glov_font.ALIGN.HFIT,
        x1 - x - 5, 0,
        level_data.display_name);
      y += ui.font_height * 1.35;
    }
    y += ui.font_height * 0.5;

    x = x0 + (side_visible ? 40 : 0);
    font.drawSizedAligned(score_style, x, y, z, ui.font_height, glov_font.ALIGN.HFIT, x1 - x - 5, 0,
      side_visible ? 'SCORE (lower is better)' : 'Score');
    y += ui.font_height;
    let indent = (side_visible ? 20 : 2);
    x += indent;
    font.drawSizedAligned(score_style, x, y, z, ui.font_height * 0.75, glov_font.ALIGN.HLEFT, 0, 0,
      `H${side_visible ? 'eight' : ''}: ${state.active_height}`);
    y += ui.font_height * 0.75;
    let maxfu = level_data.max_score && level_data.max_score[1] !== null;
    let over_limits = false;
    let fu_style = score_style;
    if (maxfu && state.num_join > level_data.max_score[1]) {
      over_limits = true;
      complete = false;
      fu_style = score_style_bad;
    }
    font.drawSizedAligned(fu_style, x, y, z, ui.font_height * 0.75, glov_font.ALIGN.HFIT, x1 - x - 2, 0,
      `Fu${side_visible ? 'sions' : ''}: ${state.num_join}${maxfu ?
        side_visible ? ` (max ${level_data.max_score[1]})` : `/${level_data.max_score[1]}` :
        ''}`);
    y += ui.font_height * 0.75;
    let maxfi = level_data.max_score && level_data.max_score[2] !== null;
    let fi_style = score_style;
    if (maxfi && state.num_split > level_data.max_score[2]) {
      over_limits = true;
      complete = false;
      fi_style = score_style_bad;
    }
    font.drawSizedAligned(fi_style, x, y, z, ui.font_height * 0.75, glov_font.ALIGN.HFIT, x1 - x - 2, 0,
      `Fi${side_visible ? 'ssions' : ''}: ${state.num_split}${maxfi ?
        side_visible ? ` (max ${level_data.max_score[2]})` : `/${level_data.max_score[2]}` :
        ''}`);
    y += ui.font_height * 0.75;
    x -= indent;
    let total_style = score_style;
    if (over_limits) {
      total_style = score_style_bad;
    } else if (!complete) {
      total_style = score_style_bad_static;
    }
    if (!complete) {
      font.drawSizedAligned(total_style, x, y, z, ui.font_height, glov_font.ALIGN.HFIT, x1 - x - 2, 0,
        side_visible ? over_limits ? 'Over limits' : 'Goal not met' : over_limits ? 'Limt' : 'Inc');
    }
    y += ui.font_height;

    y += ui.font_height * 0.5;

    x = x0;
    let did_reset = false;
    let next_ok = (complete || state.ever_complete) || score_system.getScore(level);
    let bonus_available = true;
    for (let ii = 0; ii < levels.length - 1; ++ii) {
      if (levels[ii].saved && levels[ii].saved.ever_complete) {
        continue;
      }
      if (score_system.getScore(ii)) {
        continue;
      }
      if (ii === level && complete) {
        continue;
      }
      bonus_available = false;
      break;
    }
    let next_disabled = bonus_available ? level === levels.length - 1 : level === levels.length - 2;
    if (side_visible) {
      let button_w = 150;
      if (ui.buttonText({
        x, y, w: button_w, text: next_disabled ?
          'No more levels' :
          next_ok ?
            level === levels.length - 2 ? 'Bonus Level!' : 'Next Level' :
            'Skip Level',
        disabled: next_disabled,
        colors: next_ok ? colors_good : null,
      })) {
        ++level;
        did_reset = true;
        reset(true);
      }
      x += button_w + 8;
      if (ui.buttonText({ x, y, w: button_w, text: 'Reset' })) {
        did_reset = true;
        reset();
      }
      y += ui.button_height + 8;
      x = x0;
      if (level > 0) {
        if (ui.buttonText({
          x, y, w: button_w, text: 'Previous Level',
        })) {
          --level;
          did_reset = true;
          reset(true);
        }
      }
      y += ui.button_height + 8;

      x = x0;
      y += ui.font_height * 0.5;

      if (level_data.hint) {
        font.drawSizedWrapped(hint_style, x, y, z, x1 - x - 5,
          20, ui.font_height * 0.75, level_data.hint);
        level_data.did_hint = true;
      }

      y += ui.font_height * 5; // regardless of hint height

      showHighScores(x, y);

      y = side_height - ui.button_height - 10;
      if (ui.buttonText({
        x: x1 - 120 - 10, w: 120, y, z, text: sound_manager.music_on ? 'Music: ON' : 'Music: Off'
      })) {
        sound_manager.music_on = !sound_manager.music_on;
        state.update();
      }
    } else {
      if (ui.buttonText({
        x: x1 - ui.button_height - 10, y, w: ui.button_height,
        text: '→', disabled: next_disabled,
        colors: next_ok ? colors_good : null,
      })) {
        ++level;
        did_reset = true;
        reset(true);
      }
      y += ui.button_height + 8;
      if (level > 0) {
        if (ui.buttonText({ x: x1 - ui.button_height - 10, y, w: ui.button_height,
          text: '←' })
        ) {
          --level;
          did_reset = true;
          reset(true);
        }
      }
      y += ui.button_height + 8;
      if (level_data.hint && ui.buttonText({
        colors: !level_data.did_hint ? colors_good : null,
        x: x1 - ui.button_height - 10, y, w: ui.button_height,
        text: '!'
      })) {
        level_data.did_hint = true;
        ui.modalDialog({
          text: `\n${level_data.hint}`,
          buttons: { Ok: null },
          click_anywhere: true,
        });
      }
      y += ui.button_height + 8;
    }

    if (selected_elem) {
      const BIG_SCALE = 0.75;
      const PAD = 25;
      const BIG_W = BIG_SCALE * (BOARD_W / 2 - PAD);
      let BIG_H = BIG_W * 1.20;
      let BIG_BORDER = 8 * BIG_SCALE;
      let bg_hsv = periodic[selected_elem][2];
      let bg_color = vec4(1,1,1, 1);
      hsvToRGB(bg_color, bg_hsv[0], bg_hsv[1], bg_hsv[2]);
      z = Z.UI + 50;
      if (input.mousePos()[0] < camera2d.x0() + (x0 - camera2d.x0()) * 3 / 4) {
        x = camera2d.x1() - side_width - PAD - BIG_W;
      } else {
        x = camera2d.x0() + PAD;
      }
      if (input.mousePos()[1] < side_height * 2 / 3) {
        y = camera2d.y1() - BIG_H - PAD;
      } else {
        y = camera2d.y0() + PAD;
      }

      font_periodic.drawSizedAligned(score_style, x + BIG_BORDER*2, y + BIG_H * 0.2, z, ui.font_height * 9 * BIG_SCALE,
        glov_font.ALIGN.HCENTERFIT, BIG_W - BIG_BORDER * 4, 0,
        periodic[selected_elem] ? periodic[selected_elem][0] : '!!!!');
      font_periodic.drawSizedAligned(score_style, x + BIG_BORDER*2, y + BIG_H * 0.75, z, ui.font_height * 2 * BIG_SCALE,
        glov_font.ALIGN.HCENTERFIT, BIG_W - BIG_BORDER * 4, 0,
        periodic[selected_elem] ? periodic[selected_elem][1] : 'Danger!');
      ui.drawRect(x, y, x + BIG_W, y + BIG_H, z - 2, color_black);
      ui.drawRect(x + BIG_BORDER, y + BIG_BORDER,
        x + BIG_W - BIG_BORDER, y + BIG_H - BIG_BORDER, z - 1, bg_color);
      font_periodic.drawSizedAligned(score_style, x + BIG_BORDER + 8, y + BIG_BORDER + 8, z,
        ui.font_height * 3.5 * BIG_SCALE,
        glov_font.ALIGN.HLEFT, 0, 0, `${selected_elem}`);
    }

    if (!did_reset) {
      if (complete) {
        score_system.setScore(level,
          { height: state.active_height, fu: state.num_join, fi: state.num_split }
        );
        if (!state.ever_complete) {
          ui.playUISound('fanfare', 0.2);
          state.ever_complete = true;
          ui.modalDialog({
            title: 'Level Complete!',
            text: bonus_available ?
              'Bonus level unlocked!' :
              did_long_complete ?
                '' :
                'Congratulations, you have completed the level!\n\nYou may try to' +
                ' improve your score, if possible, or move on to the next level.',
            buttons: { Ok: null },
            click_anywhere: true,
          });
          did_long_complete = true;
        } else if (!state.last_complete) {
          ui.playUISound('fanfare', 0.2);
        }
      }
      state.last_complete = complete;
    }
  }

  function testInit(dt) {
    engine.setState(test);
    test(dt);
  }

  initGraphics();
  engine.setState(testInit);
}
