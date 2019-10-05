/*eslint global-require:off, no-bitwise:off */

const glov_local_storage = require('./glov/local_storage.js');
glov_local_storage.storage_prefix = 'LD43';

const engine = require('./glov/engine.js');
const camera2d = require('./glov/camera2d.js');
const glov_font = require('./glov/font.js');
const glov_input = require('./glov/input.js');
const glov_particles = require('./glov/particles.js');
const glov_sprites = require('./glov/sprites.js');
const glov_sprite_animation = require('./glov/sprite_animation.js');
const glov_transition = require('./glov/transition.js');
const periodic = require('./periodic.js');
const pico8 = require('./glov/pico8.js');
const ui = require('./glov/ui.js');
const { floor } = Math;

const { vec2, vec4, v4clone, v4copy } = require('./glov/vmath.js');

const DEBUG = 1;

window.Z = window.Z || {};
Z.BACKGROUND = 0;
Z.SPRITES = 10;
Z.PARTICLES = 20;

const GAME_WIDTH_SIDE = 1000;
const GAME_WIDTH_CLOSED = 652;
// let app = exports;
// Virtual viewport for our game logic
export let game_width = GAME_WIDTH_SIDE;
const BOARD_W = 600;
export const game_height = 900;

export let sprites = {};

const color_white = vec4(1, 1, 1, 1);
const color_black = vec4(0, 0, 0, 1);

export function main() {
  if (!engine.startup({
    game_width,
    game_height,
    pixely: 'off',
    viewport_postprocess: false,
    sound_manager: require('./glov/sound_manager.js').create(),
    show_fps: false,
    antialias: false,
    ui_sprites: {
      button: ['ui.local/button', [2,60,2], [64]],
      button_rollover: ['ui.local/button_rollover', [2,60,2], [64]],
      button_down: ['ui.local/button_down', [2,60,2], [64]],
      button_disabled: ['ui.local/button_disabled', [2,60,2], [64]],
    },
  })) {
    return;
  }

  const font = engine.font;

  const sound_manager = engine.sound_manager;
  // const font = engine.font;

  // Perfect sizes for pixely modes
  //ui.scaleSizes(13 / 32);
  //ui.setFontHeight(8);

  const createSprite = glov_sprites.create;

  function initGraphics() {

    sound_manager.loadSound('test');

    sprites.white = createSprite({ url: 'white' });
    sprites.pipes = createSprite({ name: 'pipes', layers: 2, ws: [128, 128, 128, 128], hs: [128] });

    sprites.game_bg = createSprite({
      url: 'white',
      size: vec2(1, 1),
    });
  }

  const LEFT = 1;
  const RIGHT = 2;
  // const SPLIT = 3;
  const OUTPUT = 4;

  function GameState() {
    this.w = 12;
    this.h = 16;
    this.board = new Array(this.h);
    for (let ii = 0; ii < this.board.length; ++ii) {
      this.board[ii] = new Array(this.w);
      for (let jj = 0; jj < this.board[ii].length; ++jj) {
        this.board[ii][jj] = { v: 0, state: 0, pos: [ii, jj] };
      }
    }
    this.board[0][1].v = 102;
    this.board[0][3].v = 90;
    this.board[0][5].v = 53;
    this.board[0][7].v = 7;
    this.board[0][9].v = 31;
    this.edges = new Array(this.h - 1);
    for (let ii = 0; ii < this.edges.length; ++ii) {
      this.edges[ii] = new Array(this.w * 2 - 1);
      for (let jj = 0; jj < this.edges[ii].length; ++jj) {
        this.edges[ii][jj] = 0;
      }
    }
    this.goal = [16, 8, 109, 1, 53, 7, 31];

    if (DEBUG) {
      this.edges[0][11] =
      this.edges[0][14] =
      this.edges[0][15] =
      this.edges[1][12] =
      this.edges[1][15] = 1;
    }
  }

  GameState.prototype.addTo = function (elem, v) {
    if (elem.v) {
      this.num_join++;
    }
    elem.v += v;
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
        if (!v) {
          continue;
        }
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
          this.addTo(next[p1], v1);
          this.addTo(next[p2], v2);
          tallest = ii + 1;
        } else if (e1) {
          tallest = ii + 1;
          this.addTo(next[p1], v);
        } else if (e2) {
          tallest = ii + 1;
          this.addTo(next[p2], v);
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
  };

  let state;
  function reset() {
    state = new GameState();
    state.update();
  }
  reset();

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

  let side_visible = true;

  function test(dt) {
    if (side_visible) {
      game_width = GAME_WIDTH_SIDE;
      engine.setGameDims(game_width, game_height);
      camera2d.setAspectFixed(game_width, game_height);
    } else {
      game_width = GAME_WIDTH_CLOSED;
      engine.setGameDims(game_width, game_height);
      camera2d.setAspectFixed(game_width, game_height);
    }
    const HSPACE = (BOARD_W - 24) / state.w;
    const CELL_H = ui.font_height;
    const EDGE_H = ui.font_height;
    const BUTTON_W = (HSPACE - 4) / 2;
    const BUTTON_IMG_W = HSPACE / 2;
    const RECT_BORDER = 2;
    const RECT_HW = HSPACE * 0.5;
    let x0 = RECT_HW;
    let x;
    let y = 10;
    let z = Z.UI;
    function print(text, style) {
      font.drawSizedAligned(style, x, y, z, ui.font_height, glov_font.ALIGN.HCENTER, 0, 0, String(text));
    }
    print.height = CELL_H;
    function elementFull(v, style, color) {
      font.drawSizedAligned(style, x, y + CELL_H * 0.125, z, ui.font_height * 1.25,
        glov_font.ALIGN.HCENTER, 0, 0, periodic[v] ? periodic[v][0] : '??');
      ui.drawRect(x - RECT_HW, y, x + RECT_HW, y + CELL_H * 2, z - 2, color || color_white);
      ui.drawRect(x - RECT_HW + RECT_BORDER, y + RECT_BORDER,
        x + RECT_HW - RECT_BORDER, y + CELL_H * 2 - RECT_BORDER, z - 1, color_black);
      font.drawSizedAligned(style, x - RECT_HW + RECT_BORDER, y + CELL_H * 1.25, z, ui.font_height * 0.75,
        glov_font.ALIGN.HRIGHT, RECT_HW * 2 - RECT_BORDER * 2, 0, `${v}`);
    }
    elementFull.height = CELL_H * 2;
    const SMALL_HW = HSPACE * 0.45;
    function elementSmall(v, style, color) {
      let bg_style = glov_font.styleAlpha(style, 0.5);
      bg_style = glov_font.style(bg_style, {
        outline_width: 1.5,
        outline_color: bg_style.color
      });
      font.drawSizedAligned(bg_style, x - SMALL_HW + RECT_BORDER - 4, y, z, ui.font_height,
        glov_font.ALIGN.HCENTER,
        SMALL_HW * 2 - RECT_BORDER * 2, 0, `${periodic[v] ? periodic[v][0] : '??'}`);
      ui.drawRect(x - SMALL_HW, y, x + SMALL_HW, y + CELL_H, z - 2, color || color_white);
      ui.drawRect(x - SMALL_HW + RECT_BORDER, y + RECT_BORDER,
        x + SMALL_HW - RECT_BORDER, y + CELL_H - RECT_BORDER, z - 1, color_black);
      let fg_style = glov_font.style(style, {
        outline_width: 1,
        outline_color: 0x00000080,
      });
      font.drawSizedAligned(fg_style, x - SMALL_HW + RECT_BORDER, y, z + 0.1, ui.font_height * 0.75,
        glov_font.ALIGN.HRIGHT | glov_font.ALIGN.VBOTTOM, SMALL_HW * 2 - RECT_BORDER * 2, CELL_H, String(v));
    }
    elementSmall.height = CELL_H;
    function numberSmall(v, style, color) {
      ui.drawRect(x - SMALL_HW, y, x + SMALL_HW, y + CELL_H, z - 2, color || color_white);
      ui.drawRect(x - SMALL_HW + RECT_BORDER, y + RECT_BORDER,
        x + SMALL_HW - RECT_BORDER, y + CELL_H - RECT_BORDER, z - 1, color_black);
      font.drawSizedAligned(style, x - SMALL_HW + RECT_BORDER, y, z + 0.1, ui.font_height,
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
          if (!row[jj].state) {
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
          if (state.board[ii][parent] && state.board[ii][parent].v) {
            let right = Boolean((jj + ii) & 1);
            // let text = erow[jj] ? right ? '\\' : '/' : '-';
            // if (ui.buttonText({
            //   x: x - BUTTON_W / 2, y, z, w: BUTTON_W, h: EDGE_H, text
            if (ui.buttonImage({
              x: x - BUTTON_IMG_W / 2, y, z, w: BUTTON_IMG_W, h: EDGE_H,
              img: sprites.pipes,
              shrink: 1,
              frame: erow[jj] ? right ? 2 : 3 : right ? 0 : 1,
              colors: {
                down: [0,0,0,1],
                rollover: [1,1,1,1],
                regular: [0.2,0.2,0.2,1],
              },
              color: pico8.colors[12],
              color1: [1,1,1,1],
              // no_bg: true,
            })) {
              erow[jj] = 1 - erow[jj];
              state.update();
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
    x = 30;
    print('Goal:');
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
      x += HSPACE + 10;
    }


    sprites.game_bg.draw({
      x: 0, y: 0, z: Z.BACKGROUND,
      w: BOARD_W, h: game_height,
      color: [0.1, 0.1, 0.1, 1]
    });

    // draw side UI
    x = BOARD_W;
    y = 0;
    sprites.game_bg.draw({
      x, y, z: Z.BACKGROUND,
      w: game_width - BOARD_W, h: game_height,
      color: [0.9, 0.9, 0.9, 1]
    });

    if (ui.buttonText({
      x: game_width - ui.button_height - 10, y: 10 ,
      w: ui.button_height,
      text: side_visible ? '>>' : '<<',
    })) {
      side_visible = !side_visible;
    }

    x0 = BOARD_W + (side_visible ? 10 : 5);
    y += side_visible ? 10 : 20;
    x = x0;

    y += ui.button_height;
    x = x0;
    let score_style = glov_font.style(null, {
      color: 0x000000ff,
    });
    font.drawSizedAligned(score_style, x, y, z, ui.font_height, glov_font.ALIGN.HFIT, game_width - x - 5, 0,
      side_visible ? 'SCORE' : 'Score');
    y += ui.font_height;
    x = x0 + (side_visible ? 20 : 2);
    font.drawSizedAligned(score_style, x, y, z, ui.font_height * 0.75, glov_font.ALIGN.HLEFT, 0, 0,
      `H${side_visible ? 'eight' : ''}: ${state.active_height}`);
    y += ui.font_height * 0.75;
    font.drawSizedAligned(score_style, x, y, z, ui.font_height * 0.75, glov_font.ALIGN.HLEFT, 0, 0,
      `Fu${side_visible ? 'sers' : ''}: ${state.num_join}`);
    y += ui.font_height * 0.75;
    font.drawSizedAligned(score_style, x, y, z, ui.font_height * 0.75, glov_font.ALIGN.HLEFT, 0, 0,
      `Fi${side_visible ? 'ssurers' : ''}: ${state.num_split}`);
    y += ui.font_height * 0.75;
    x = x0;
    font.drawSizedAligned(score_style, x, y, z, ui.font_height, glov_font.ALIGN.HLEFT, 0, 0,
      `${side_visible ? 'Total: ' : ''}${complete ?
        `${state.active_height}/${state.num_join}/${state.num_split}` :
        side_visible ? 'Goal not met' : 'Inc'}`);
    y += ui.font_height;

    y += ui.font_height * 0.5;

    if (side_visible) {
      let button_w = 150;
      if (ui.buttonText({ x, y, w: button_w, text: 'Next Level', disabled: !complete })) {
        reset();
      }
      x += button_w + 8;
      if (ui.buttonText({ x, y, w: button_w, text: 'Reset' })) {
        reset();
      }
    } else {
      if (ui.buttonText({ x: game_width - ui.button_height - 10, y, w: ui.button_height,
        text: '->', disabled: !complete })
      ) {
        reset();
      }
    }
  }

  function testInit(dt) {
    engine.setState(test);
    test(dt);
  }

  initGraphics();
  engine.setState(testInit);
}
