import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

import {Text_Line} from "./examples/text-demo.js";

export class Assignment3 extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            text: new Text_Line(35),
            single_arrow: new defs.Single_Arrow(),
            square: new defs.Square(),
            sphere1: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            sphere2: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            sphere3: new defs.Subdivision_Sphere(3),
            sphere4: new defs.Subdivision_Sphere(4),
            circle: new defs.Regular_2D_Polygon(1, 15),
            cylinder: new defs.Cylindrical_Tube(10, 20),
        };

        this.ball_radius = 0.8;
        this.keeper_height = 2;
        this.ball_time = 0;
        this.shoot_ball = false;
        this.have_determined_ball_v0 = false;

        this.goal_height = 10;
        this.goal_width = 20;
        this.goal_z = -5;

        this.thrust = {
            'target': vec3(0, 0, 0),
            'keeper': vec3(0, 0, 0),
            'ball_arrow': vec4(0, 0, 0),
        }
        this.position = {
            'target': vec3(0, 0, 0),
            'keeper': vec3(0, 0, 0),
            'ball_arrow': vec3(0, 0, 0),
            'ball': vec3(0, 0, 0),
        };
        this.next_direction = {
            'target': null,
            'keeper': null,
            'ball_arrow': null
        };
        this.object_moved = {
            'keeper': false,
            'target': false,
            'ball_arrow': false
        };

        this.direction_to_axis = {
            'left_right': 0,
            'up_down': 1,
            'forward_backward': 2,
        }

        this.max_score = 5;

        this.score = {
            "player1": 0,
            "player2": 0,
        }

        // have player 1 start
        this.currently_playing = {
            "player1": true,
            "player2": false
        }

        this.player1_color = hex_color("#ff0000");
        this.player2_color = hex_color("#0000ff");

        this.mode = 'single_player_keeper';
        // init to be compatible with mode
        this.button_description = 'Move Keeper';

        const bump = new defs.Fake_Bump_Map(1);
        // *** Materials
        this.materials = {
            ball: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#FFFFFF")}),
            target: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#FF0000")}),
            ball_arrow: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1}),
            field: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#00FF00")}),
            goal_post: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#FFFFFF")}),
            // stadium_right is from https://www.flickr.com/photos/ronmacphotos/10628910656
            // and is creative commons 2.0
            stadium_right: new Material(bump, {ambient: .5, texture: new Texture("assets/stadium_right.png")}),
            stadium_behind: new Material(bump, {ambient: .5, texture: new Texture("assets/stadium_behind.png")}),
            stadium_left: new Material(bump, {ambient: .5, texture: new Texture("assets/stadium_left.png")}),
            score: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/text.png")
            }),
            keeper: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0, color: hex_color("#ffff00")
            }),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 32), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {


        let remove_buttons = (ids) => {
            for (const id of ids) {
                let elem = document.getElementById(id);
                if (elem !== null) {
                    elem.remove();
                }
            }
        }

        let move_keeper_buttons = ['i', 'j', 'l', 'k'];

        let update_mode = (mode) => {
            this.mode = mode;
            if (mode === 'two_player') {
                this.button_description = 'Move Keeper'
                this.object_type = 'keeper';
                // remove previously existing buttons
                remove_buttons(move_keeper_buttons);
                this.key_triggered_button(`${this.button_description} Left`, ["j"],
                    () => button_cb(this.object_type, -1, 'left_right'));
                this.key_triggered_button(`${this.button_description} Right`, ["l"],
                    () => button_cb(this.object_type, 1, 'left_right'));
                // TODO: figure out if keeper should be able to jump
                this.key_triggered_button(`${this.button_description} Up`, ["i"],
                    () => button_cb(this.object_type, 1, 'up_down'));
                this.key_triggered_button(`${this.button_description} Down`, ["k"],
                    () => button_cb(this.object_type, -1, 'up_down'));
            } else if (mode === 'practice') {
                this.object_type = 'target';
                remove_buttons(move_keeper_buttons);
            } else if (mode === 'single_player_keeper') {
                this.object_type = 'keeper';
                remove_buttons(move_keeper_buttons);
            }
        }

        this.key_triggered_button("Go to Practice mode", ["p"],
            () => {update_mode('practice')});

        this.key_triggered_button("Go to Single Player mode", ["1"],
            () => {update_mode('single_player_keeper')});

        this.key_triggered_button("Go to Two Player mode", ["2"],
            () => {update_mode('two_player')});

        // object_type is either ball or target
        // thrust_val is the value for the thrust
        // direction is the axis (0 for left_right, 1 for up_down, 2 for forward_backward)
        let button_cb = (object_type, thrust_val, direction) => {
            this.next_direction[object_type] = direction;
            this.object_moved[object_type] = true;
            this.thrust[object_type][this.direction_to_axis[direction]] = thrust_val;
        };

        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        // use ArrowUp/Down/Left/Right for arrow keys found from https://stackoverflow.com/a/44213036
        this.key_triggered_button("Move arrow Up", ["ArrowDown"],
            () => button_cb('ball_arrow', -1, 'forward_backward'));
        this.key_triggered_button("Move arrow Down", ["ArrowUp"],
            () => button_cb('ball_arrow', 1, 'forward_backward'));
        this.key_triggered_button("Move arrow Left", ["ArrowLeft"],
            () => button_cb('ball_arrow', 1, 'left_right'));
        this.key_triggered_button("Move arrow Right", ["ArrowRight"],
            () => button_cb('ball_arrow', -1, 'left_right'));

        this.key_triggered_button("Shoot ball", ["Enter"],
            () => {this.shoot_ball = true; this.ball_time = 0;});

    }

    make_goal(context, program_state, x) {
        // GOAL POST
        let left_goal_post_transform = Mat4.identity();
        left_goal_post_transform = left_goal_post_transform
            .times(Mat4.translation((-0.5 * this.goal_width) + x,  this.goal_height/2, this.goal_z))
            .times(Mat4.scale(0.3, this.goal_height, 0.3))
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0));
        this.shapes.cylinder.draw(context, program_state, left_goal_post_transform, this.materials.goal_post);


        let right_goal_post_transform = Mat4.identity();
        right_goal_post_transform = right_goal_post_transform
            .times(Mat4.translation((this.goal_width * 0.5) + x, this.goal_height / 2, this.goal_z))
            .times(Mat4.scale(0.3, this.goal_height, 0.3))
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0));
        this.shapes.cylinder.draw(context, program_state, right_goal_post_transform, this.materials.goal_post);


        let top_goal_post_transform = Mat4.identity();
        top_goal_post_transform = top_goal_post_transform
            .times(Mat4.translation(x, this.goal_height, this.goal_z))
            .times(Mat4.scale(this.goal_width, 0.3, 0.3))
            .times(Mat4.rotation(Math.PI/2, 0, 1, 0));
        this.shapes.cylinder.draw(context, program_state, top_goal_post_transform, this.materials.goal_post);


        let left_tilt_post_transform = Mat4.identity();
        left_tilt_post_transform = left_tilt_post_transform
            .times(Mat4.translation((-0.5 * this.goal_width) + x, this.goal_height / 2, (-1 * this.goal_height / 2 * Math.tan(Math.PI/6)) + this.goal_z))
            .times(Mat4.rotation(Math.PI/3, -1, 0, 0))
            .times(Mat4.scale(0.3, 0.3, this.goal_height / Math.cos(Math.PI/6)));
        this.shapes.cylinder.draw(context, program_state, left_tilt_post_transform, this.materials.goal_post);

        let right_tilt_post_transform = Mat4.identity();
        right_tilt_post_transform = right_tilt_post_transform
            .times(Mat4.translation((0.5 * this.goal_width) + x, this.goal_height / 2, (-1 * this.goal_height / 2 * Math.tan(Math.PI/6)) + this.goal_z))
            .times(Mat4.rotation(Math.PI/3, -1, 0, 0))
            .times(Mat4.scale(0.3, 0.3, this.goal_height / Math.cos(Math.PI/6)));
        this.shapes.cylinder.draw(context, program_state, right_tilt_post_transform, this.materials.goal_post);

    }

    make_stadium(context, program_state, field_dim) {
        let stadium_behind_transform = Mat4.identity();
        stadium_behind_transform = stadium_behind_transform
            .times(Mat4.translation(0, field_dim, -field_dim))
            .times(Mat4.scale(field_dim,field_dim,field_dim))
            .times(Mat4.rotation(Math.PI/2, 0, 0, 1));
        this.shapes.square.draw(context, program_state, stadium_behind_transform, this.materials.stadium_behind);

        let stadium_left_transform = Mat4.identity();
        stadium_left_transform = stadium_left_transform
            .times(Mat4.translation(-field_dim, field_dim, 0))
            .times(Mat4.scale(field_dim,field_dim,field_dim))
            .times(Mat4.rotation(Math.PI/2, 0, 1, 0));
        this.shapes.square.draw(context, program_state, stadium_left_transform, this.materials.stadium_left);

        let stadium_right_transform = Mat4.identity();
        stadium_right_transform = stadium_right_transform
            .times(Mat4.translation(field_dim, field_dim, 0))
            .times(Mat4.scale(field_dim,field_dim,field_dim))
            .times(Mat4.rotation(Math.PI/2, 0, -1, 0));
        this.shapes.square.draw(context, program_state, stadium_right_transform, this.materials.stadium_right);
    }

    updateThrustPosition(object_type) {
        let next_dir = this.next_direction[object_type]
        // reset others if equal to avoid diagonal movement
        if (next_dir === 'left_right') {
            this.thrust[1] = 0;
            this.thrust[2] = 0;
        } else if (next_dir === 'up_down' ) {
            this.thrust[0] = 0;
            this.thrust[2] = 0;
        } else if (next_dir === 'forward_backward') {
            this.thrust[0] = 0;
            this.thrust[1] = 0;
        }

        let axis = this.direction_to_axis[next_dir];
        this.position[object_type][axis] += this.thrust[object_type][axis];

        this.object_moved[object_type] = false;
    }

    player_moved_object(object_type, context, program_state) {
        let lower_boundary = {0: (-this.goal_width / 2) - 1, 1: -2};
        let upper_boundary = {0: (this.goal_width / 2) + 1, 1: (this.goal_height / 2) + 2};

        if (this.object_moved[object_type]) {
            // Assumption: next direction for target will never be z-dimension
            let axis = this.next_direction[object_type] === "left_right" ? 0 : 1;
            let position = this.position[object_type];
            let delta = this.thrust[object_type][axis];

            if (object_type === 'target') {
                if ((lower_boundary[axis] <= position[axis] + delta) && (position[axis] + delta <= upper_boundary[axis])) {
                    this.updateThrustPosition(object_type);
                } else {
                    this.object_moved[object_type] = false;
                }
            } else {
                lower_boundary = {0: (-this.goal_width / 2) - 1, 1: 0};
                upper_boundary = {0: (this.goal_width / 2) + 1, 1: 2};
                console.log(axis, ' lower boundary', lower_boundary[axis], 'upper boundary', upper_boundary[axis],
                    'pos + delta', position[axis] + delta);

                if ((lower_boundary[axis] <= position[axis] + delta) && (position[axis] + delta <= upper_boundary[axis])) {
                    this.updateThrustPosition(object_type);
                } else {
                    this.object_moved[object_type] = false;
                }
            }
        }

        let position_translation = Mat4.translation(this.position[object_type][0],
            this.position[object_type][1], this.position[object_type][2]);

        if (object_type === 'target') {
            let object_transform = Mat4.identity();
            object_transform = object_transform
                .times(Mat4.translation(0,3, this.goal_z))
                .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));

            object_transform = object_transform.times(position_translation);
            this.shapes.circle.draw(context, program_state, object_transform, this.materials[object_type]);
        } else if (object_type === 'keeper') {
            let keeper_transform = Mat4.identity();
            keeper_transform = keeper_transform
                .times(Mat4.translation(0,2, this.goal_z))
                .times(Mat4.scale(this.ball_radius, this.keeper_height, this.ball_radius))
                .times(position_translation);

            this.shapes.square.draw(context, program_state, keeper_transform, this.materials.keeper);

            // let keeper_head_transform = Mat4.identity();
            let keeper_head_transform = keeper_transform
                .times(Mat4.scale(1, 1/this.keeper_height, 1))
                .times(Mat4.translation(0, 3, 0));
                //.times(Mat4.translation(0, this.keeper_height+4, this.goal_z))
                // .times(Mat4.scale(1.5*this.ball_radius, 1.38*this.ball_radius, this.ball_radius))

            // have keeper head color be the keeper's player color
            let keeper_head_color = this.player1_color;
            if (this.currently_playing['player1']) {
                keeper_head_color = this.player2_color;
            }

            this.shapes.circle.draw(context, program_state, keeper_head_transform,
                this.materials.target.override({color: keeper_head_color}));
        }
    }

    draw_ball_arrow (context, program_state) {
        let ball_arrow_transform = Mat4.identity();
        let ball_arrow_scale = 2;
        // TODO: determine if user can move the arrow left and right or if it should stay at the center
        ball_arrow_transform = ball_arrow_transform
            .times(Mat4.translation(0, 0, 8))
            .times(Mat4.scale(ball_arrow_scale, ball_arrow_scale, ball_arrow_scale));

        // TODO: take into account the angle between the arrow vector and the field plane
        // if the angle is 0 then just have it go straight (roll on field)
        // otherwise do parabolic with the initial y-thrust/ball_y_scale a function of the angle??
        let x_rotation_angle = this.position['ball_arrow'][2]/10;
        let z_rotation_angle = this.position['ball_arrow'][0]/10;

        let determine_rotation_angle_and_update_position = (input_angle, angle_max, angle_min, axis) => {
            let angle = input_angle;
            if (angle >= angle_max) {
                angle = angle_max;
            } else if (angle <= angle_min) {
                angle = angle_min;
            }
            this.position['ball_arrow'][axis] = angle*10;
            return angle;
        }

        // FIXME: make z_rotation_angle a function of goal width
        z_rotation_angle = determine_rotation_angle_and_update_position(
            z_rotation_angle, 1, -1, 0);

        let x_rotation_angle_min = -0.7;
        if (z_rotation_angle <= -0.7 || z_rotation_angle >= 0.6) {
            x_rotation_angle_min = -0.5;
        }
        x_rotation_angle = determine_rotation_angle_and_update_position(
            x_rotation_angle, 0.3, x_rotation_angle_min, 2);

        ball_arrow_transform = ball_arrow_transform
            .times(Mat4.rotation(x_rotation_angle, 1, 0, 0))
            .times(Mat4.rotation(z_rotation_angle, 0, 0, 1));

        let p1_mat = this.materials.ball_arrow.override({color: this.player1_color});
        let p2_mat = this.materials.ball_arrow.override({color: this.player2_color});
        if (this.currently_playing['player1']) {
            this.shapes.single_arrow.draw(context, program_state, ball_arrow_transform, p1_mat);
        } else {
            this.shapes.single_arrow.draw(context, program_state, ball_arrow_transform, p2_mat);
        }
        return ball_arrow_transform;
    }

    move_ball(context, program_state, ball_arrow_transform) {
        if (this.object_moved['ball_arrow']) {
            this.updateThrustPosition('ball_arrow');
        }

        let ball_transform = Mat4.identity();
        if (this.shoot_ball) {
            // z = v0_z * t where v0_z is the norm of the third row of ball_arrow_transform
            let ba_x = ball_arrow_transform.toString().split(',').slice(0, 3);
            let ba_y = ball_arrow_transform.toString().split(',').slice(4, 7);
            let ba_z = ball_arrow_transform.toString().split(',').slice(8, 11);

            // behavior notes from perspective of user
            // more positive ba_x[1] means x is more to the right
            // more negative ba_x[1] means x is more to the left
            // smaller ba_y[1] means smaller y
            // larger ba_y[1] means larger y

            if (!this.have_determined_ball_v0) {
                this.ball_v0_x = ba_x[1];
                this.ball_v0_y = ba_y[1];
                this.ball_v0_z = ba_z[2];
                this.have_determined_ball_v0 = true;
            }

            let v0_x = this.ball_v0_x;
            let ball_x = v0_x*this.ball_time;

            let v0_z = this.ball_v0_z;
            let ball_z = v0_z*this.ball_time;
            // y = v0_y * t - 0.5 g t**2 where v0_y is the norm of the second row of ball_arrow_transform
            let v0_y = this.ball_v0_y;

            // as goal_height increases ball_y_scale should decrease
            // 0.1 is a good value for a goal_height of 10
            // 0.05 is a good value for a goal_height of 20
            // note that this doesn't allow the ball to hit the top corners but that's a rare case
            let ball_y_scale = 0.1*(10/this.goal_height);
            let ball_y = v0_y * this.ball_time - ball_y_scale * this.ball_time**2;

            ball_transform = ball_transform
                .times(Mat4.translation(0, 0.9, 8))
                .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));

            ball_transform = ball_transform
                .times(Mat4.translation(ball_x, ball_y, -ball_z));

            this.position['ball'] = vec3(ball_x, ball_y, -ball_z);

            this.shapes.sphere4.draw(context, program_state, ball_transform, this.materials.ball);
            this.ball_time += 0.5;
        }
    }

    update_one_player_score(context, program_state) {
        let player1_score_transform = Mat4.identity().times(Mat4.translation(-5, 12, -8));
        this.shapes.text.set_string(`Score: ${this.score['player1']}`, context.context);
        this.shapes.text.draw(context, program_state, player1_score_transform,
            this.materials.score.override({color: this.player1_color}));
    }

    update_two_player_score(context, program_state) {
        let player1_score_transform = Mat4.identity().times(Mat4.translation(-3, 12, -8));
        this.shapes.text.set_string(`${this.score['player1']}`, context.context);
        this.shapes.text.draw(context, program_state, player1_score_transform,
            this.materials.score.override({color: this.player1_color}));
        let colon_transform = player1_score_transform.times(Mat4.translation(3, 0, 0));
        this.shapes.text.set_string(':', context.context);
        this.shapes.text.draw(context, program_state, colon_transform, this.materials.score);
        let player2_score_transform = colon_transform.times(Mat4.translation(3, 0, 0));
        this.shapes.text.set_string(`${this.score['player2']}`, context.context);
        this.shapes.text.draw(context, program_state, player2_score_transform,
            this.materials.score.override({color: this.player2_color}));
    }

    determine_if_game_over() {
        // if either score is max_score reset scores
        let reset_scores = false;
        if (this.score['player1'] === this.max_score) {
            // TODO: say good job player 1
            alert('Good job player 1');
            reset_scores = true;
        } else if (this.score['player2'] === this.max_score) {
            // TODO: say good job player 2
            alert('Good job player 2');
            reset_scores = true;
        }

        if (reset_scores) {
            this.score['player1'] = 0;
            this.score['player2'] = 0
        }
    }

    ball_object_collision_detection (object, ball_object_x_distance, ball_object_y_distance) {
        let object_pos = this.position[object];
        let ball_pos = this.position['ball'];
        let ball_pos_x = ball_pos[0], ball_pos_y = ball_pos[1];
        let object_pos_x = object_pos[0], object_pos_y = object_pos[1];

        let intersects_on_x_axis = false;
        let intersects_on_y_axis = false;
        let intersects_on_z_axis = false;

        // want ball to hit target in practice mode
        if (this.mode === 'practice') {
            // visually the circle intersects ball if it's +/- ball_object_x_distance away
            intersects_on_x_axis = Math.abs(ball_pos_x - object_pos_x) <= ball_object_x_distance;
            // same for y (height)
            intersects_on_y_axis = Math.abs(Math.floor(ball_pos_y) - object_pos_y) <= ball_object_y_distance;
            // z is -18 since that's where the goal posts are
            intersects_on_z_axis = Math.floor(ball_pos[2]) === -18;
            this.ball_intersects_goal_on_z_axis = intersects_on_z_axis;
            this.ball_collision_success = intersects_on_x_axis && intersects_on_y_axis && intersects_on_z_axis
        } else {
            // otherwise want ball to (not) hit goalkeeper
            // visually the circle intersects ball if it's +/- ball_object_x_distance away
            intersects_on_x_axis = Math.abs(ball_pos_x - object_pos_x) <= ball_object_x_distance;
            // same for y (height)
            // keeper_height + keeper_head_height = 6 and visually ball should be one above it so 7
            intersects_on_y_axis = Math.floor(ball_pos_y) <= 7;
            // z is -18 since that's where the goal posts are
            intersects_on_z_axis = Math.floor(ball_pos[2]) === -18;
            this.ball_intersects_goal_on_z_axis = intersects_on_z_axis;
            this.ball_collision_success = intersects_on_x_axis && intersects_on_y_axis && intersects_on_z_axis
        }

        if (this.ball_collision_success) {
            if (this.mode !== 'two_player') {
                this.score['player1'] += 1;
            }
            // TODO: add audio when player scores
            /*
            let a = new Audio('assets/audio/goal.m4a');
            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement/Audio
            a.addEventListener("canplaythrough", (event) => {
                // audio is now playable
                a.play();
            });
            */
        } else if (intersects_on_z_axis && (!intersects_on_y_axis || !intersects_on_x_axis)) {
            // console.log(object_pos, ball_pos, intersects_on_x_axis, intersects_on_y_axis, intersects_on_z_axis);
            // The player scores if they don't hit the keeper
            if (this.mode === 'two_player') {
                if (this.currently_playing['player1']) {
                    this.score['player1'] += 1;
                } else {
                    this.score['player2'] += 1;
                }
            }
        } else if (ball_pos[1] < -1) {
            // less than -1 so then ball will below plane and player won't be able to see the ball move
            // FIXME: the value -1 determines how quickly the new ball_arrow position
            //       will be taken into account when the user presses Enter again
            //       if it's too big say -5 then if the user moves the arrow before the ball gets to -5
            //       then the ball will go in the previously chosen direction
            this.have_determined_ball_v0 = false;
        }

        // even if the player misses still move to the next player
        if (this.mode === 'two_player' && intersects_on_z_axis) {
            this.currently_playing['player1'] = !this.currently_playing['player1'];
            this.currently_playing['player2'] = !this.currently_playing['player2'];
        }
    }

    randomly_place_target(context, program_state) {

        let object_type = 'target';

        // TODO: determine if we should move target randomly every time
        //       even if they miss (this.ball_intersects_goal_on_z_axis)
        //       OR just move target if they get a collision (this.ball_collision_success)
        if (this.ball_intersects_goal_on_z_axis) {
            let lower_boundary = {0: (-this.goal_width / 2) - 1, 1: -2};
            let upper_boundary = {0: (this.goal_width / 2) + 1, 1: (this.goal_height / 2) + 2};

            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values_inclusive
            let getRandomIntInclusive = (min, max) => {
                min = Math.ceil(min);
                max = Math.floor(max);
                return Math.floor(Math.random() * (max - min + 1) + min);
            }

            let pos_x = getRandomIntInclusive(lower_boundary[0], upper_boundary[0])
            let pos_y = getRandomIntInclusive(lower_boundary[1], upper_boundary[1])
            this.position[object_type] = vec3(pos_x, pos_y, 0);
        }

        let position_translation = Mat4.translation(this.position[object_type][0],
            this.position[object_type][1], this.position[object_type][2]);

        let object_transform = Mat4.identity();
        object_transform = object_transform
            .times(Mat4.translation(0, 3, this.goal_z))
            .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));

        object_transform = object_transform.times(position_translation);
        this.shapes.circle.draw(context, program_state, object_transform, this.materials.target);
    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        let light_position = vec4(5, 2, 0, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 3)];

        let field_transform = Mat4.identity();
        let field_dim = 20;
        field_transform = field_transform
            .times(Mat4.scale(field_dim,field_dim,field_dim))
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0));

        this.shapes.square.draw(context, program_state, field_transform, this.materials.field);

        this.make_stadium(context, program_state, field_dim);

        this.make_goal(context, program_state, 0);

        let ball_arrow_transform = this.draw_ball_arrow(context, program_state);

        this.move_ball(context, program_state, ball_arrow_transform);

        // FIXME: fix this so obvious to user what mode they are in
        //        eg two player is differently colored score
        //        one player practice is target
        //        single player keeper is just a keeper


        // Practice mode where you aim for a randomly placed target
        if (this.mode === 'practice') {
            this.randomly_place_target(context, program_state);
            this.ball_object_collision_detection('target',2, 3);
            this.update_one_player_score(context, program_state);
        }
        // TODO:
        // Single player where you against a moving AI keeper
        // make robot keeper head magenta
        else if (this.mode === 'single_player_keeper') {
            // this.move_object('keeper', context, program_state);
            this.ball_object_collision_detection('keeper',2, 3);
            this.update_one_player_score(context, program_state);
        }
        // Two player mode where one player is goalie and the other player shoots the ball
        else if (this.mode === 'two_player') {
            this.player_moved_object('keeper', context, program_state);
            // note ball_object_x, y distance are ignored by ball_object_collision_detection
            // since not shooting against a target
            this.ball_object_collision_detection('keeper',2, 3);
            this.update_two_player_score(context, program_state);
        }

        this.determine_if_game_over();
    }
}

class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;
        varying vec4 vertex_color;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                // Compute an initial (ambient) color:
                vertex_color = vec4( shape_color.xyz * ambient, shape_color.w );
                // Compute the final color with contributions from lights:
                vertex_color.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){                                                           
                gl_FragColor = vertex_color;
            } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 position_OCS;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
            // the vertex's final resting place in NDCS
            gl_Position = projection_camera_model_transform * vec4(position, 1.0);
            position_OCS = vec4(position, 1.0);
        }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
        uniform vec4 shape_color;
        void main(){
            float factor = 0.2 + 0.5 * sin((position_OCS.x * position_OCS.x)*50.0 + (position_OCS.y * position_OCS.y)*50.0);
            vec4 mixed_color = vec4(shape_color.xyz, factor);
            gl_FragColor = mixed_color + vec4(0.7, 0.5, 0, 0);
        }`;
    }
}

