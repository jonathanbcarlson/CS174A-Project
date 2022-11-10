import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

export class Assignment3 extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            single_arrow: new defs.Single_Arrow(),
            square: new defs.Square(),
            torus: new defs.Torus(40, 40),
            torus2: new defs.Torus(3, 15),
            sphere1: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            sphere2: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            sphere3: new defs.Subdivision_Sphere(3),
            sphere4: new defs.Subdivision_Sphere(4),
            circle: new defs.Regular_2D_Polygon(1, 15),
            cylinder: new defs.Cylindrical_Tube(10, 20),
        };

        this.ball_radius = 0.8;
        this.ball_time = 0;
        this.shoot_ball = false;
        this.have_determined_ball_v0 = false;

        this.goal_height = 10;
        this.goal_width = 20;
        this.goal_z = -5;

        this.thrust = {
            'target': vec3(0, 0, 0),
            'ball_arrow': vec4(0, 0, 0),
        }
        this.position = {
            'target': vec3(0, 0, 0),
            'ball_arrow': vec3(0, 0, 0),
            'ball': vec3(0, 0, 0),
        };
        this.next_direction = {
            'target': null,
            'ball_arrow': null
        };
        this.object_moved = {
            'target': false,
            'ball_arrow': false
        };

        this.direction_to_axis = {
            'left_right': 0,
            'up_down': 1,
            'forward_backward': 2,
        }

        const bump = new defs.Fake_Bump_Map(1);
        // *** Materials
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            test2: new Material(new Gouraud_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#992828")}),
            ring: new Material(new Ring_Shader()),
            ball: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#FFFFFF")}),
            target: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#FF0000")}),
            ball_arrow: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#FF00FF")}),
            field: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#00FF00")}),
            goal_post: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, specularity: 1, color: hex_color("#FFFFFF")}),
            // stadium_right is from https://www.flickr.com/photos/ronmacphotos/10628910656
            // and is creative commons 2.0
            stadium_right: new Material(bump, {ambient: .5, texture: new Texture("assets/stadium_right.png")}),
            stadium_behind: new Material(bump, {ambient: .5, texture: new Texture("assets/stadium_behind.png")}),
            stadium_left: new Material(bump, {ambient: .5, texture: new Texture("assets/stadium_left.png")}),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 30), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
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

        this.key_triggered_button("Move target Up", ["i"],
            () => button_cb('target', 1, 'up_down'));
        this.key_triggered_button("Move target Down", ["k"],
            () => button_cb('target', -1, 'up_down'));
        this.key_triggered_button("Move target Left", ["j"],
            () => button_cb('target', -1, 'left_right'));
        this.key_triggered_button("Move target Right", ["l"],
            () => button_cb('target', 1, 'left_right'));

        this.key_triggered_button("Shoot ball", ["Enter"],
            () => {this.shoot_ball = true; this.ball_time = 0});
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

    move_target(context, program_state) {
        let lower_boundary = {0: (-this.goal_width / 2) - 1, 1: -2};
        let upper_boundary = {0: (this.goal_width / 2) + 1, 1: (this.goal_height / 2) + 2};

        if (this.object_moved['target']) {
            // Assumption: next direction for target will never be z-dimension
            let axis = this.next_direction['target'] === "left_right" ? 0 : 1;
            let target = this.position['target'];
            let delta = this.thrust['target'][axis];

            if ((lower_boundary[axis] <= target[axis] + delta) && (target[axis] + delta <= upper_boundary[axis])) {
                this.updateThrustPosition('target');
            }
            else {
                this.object_moved['target'] = false;
            }
        }

        let target_transform = Mat4.identity();
        target_transform = target_transform
            .times(Mat4.translation(0,3, this.goal_z))
            .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));

        target_transform = target_transform
            .times(Mat4.translation(this.position['target'][0],
                this.position['target'][1], this.position['target'][2]));

        this.shapes.circle.draw(context, program_state, target_transform, this.materials.target);
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
        console.log('x_angle=', x_rotation_angle, 'z_angle=', z_rotation_angle)

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

        this.shapes.single_arrow.draw(context, program_state, ball_arrow_transform, this.materials.ball_arrow);
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

    ball_target_collision_detection(ball_target_x_distance, ball_target_y_distance) {
        let target_pos = this.position['target'];
        let ball_pos = this.position['ball'];
        let ball_pos_x = ball_pos[0], ball_pos_y = ball_pos[1];
        let target_pos_x = target_pos[0], target_pos_y = target_pos[1];
        // visually the circle intersects ball if it's +/- ball_target_x_distance away
        let intersects_on_x_axis = Math.abs(ball_pos_x - target_pos_x) <= ball_target_x_distance;
        // same for y (height)
        let intersects_on_y_axis = Math.abs(Math.floor(ball_pos_y) - target_pos_y) <= ball_target_y_distance;
        // z is -18 since that's where the goal posts are
        let intersects_on_z_axis = Math.floor(ball_pos[2]) === -18;
        if (intersects_on_x_axis && intersects_on_y_axis && intersects_on_z_axis) {
            // TODO: increment a score or something
            console.log('COLLISION', target_pos, ball_pos);
            /*
            let a = new Audio('assets/audio/goal.m4a');
            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement/Audio
            a.addEventListener("canplaythrough", (event) => {
                // audio is now playable
                a.play();
            });
            */
        } else if (intersects_on_z_axis) {
            console.log(target_pos, ball_pos, intersects_on_x_axis, intersects_on_y_axis, intersects_on_z_axis);
        } else if (ball_pos[1] < -1) {
            // less than -1 so then ball will below plane and player won't be able to see the ball move
            // FIXME: the value -1 determines how quickly the new ball_arrow position
            //       will be taken into account when the user presses Enter again
            //       if it's too big say -5 then if the user moves the arrow before the ball gets to -5
            //       then the ball will go in the previously chosen direction
            this.have_determined_ball_v0 = false;
        }
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

        this.move_target(context, program_state);

        let ball_arrow_transform = this.draw_ball_arrow(context, program_state);

        this.move_ball(context, program_state, ball_arrow_transform);

        this.ball_target_collision_detection(2, 3);
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

