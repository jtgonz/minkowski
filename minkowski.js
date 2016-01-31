"use strict"

// define (0,0) and (1,1) in terms of display coordinates 
let [x0, y0, x1, y1] = [200, 200, 400, 0];

// how often should we update the display? (in milliseconds)
let update_interval = 40;

// how fast should the user age?
let clock_speed = 0.02

/* ***************************************************************************** */

// create scale to map minkowski coordinates to display coordinates
function set_scale (x0, y0, x1, y1) {
  let x = d3.scale.linear()
      .domain([0, 1])
      .range([x0, x1]);
  let t = d3.scale.linear()
      .domain([0, 1])
      .range([y0, y1]);
  return [x, t];
}

// given frame and line generator, draw axes and return d3 selections
function draw_axes (frame, line) {
  let x_endpts = [{x: -1, t: 0}, {x: 1, t: 0}];
  let y_endpts = [{x: 0, t: 0}, {x: 0, t: 1}];

  return [x_endpts, y_endpts].map( d => {
    return frame.append('path')
        .datum(d)
        .attr('d', line)
        .attr('stroke', '#bbb');
  });
}

function place_object (ob_list, x, t, id) {
  return ob_list.push({x: x, t: t, id: id});
}

function set_frame_width (frame, w, h) {
  return frame.attr('width', w).attr('height', h)
}

function render_particles (frame, particles, x, t) {
  frame.selectAll('g.particle')
      .data(particles, d => d.id)
      .attr('transform', d => 'translate(' + x(d.x) + ',' + t(d.t) + ')')
    .enter()
      .append('g')
      .attr('class', 'particle')
      .attr('transform', d => 'translate(' + x(d.x) + ',' + t(d.t) + ')')
      .append('circle')
      .attr('transform', 'translate(0, -10)')
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 10)
      .style("fill", 'black');
  return frame;
}

function render_worldlines (frame, lines_data, line) {
  frame.selectAll('g.worldline').select('path')
      .data(lines_data, d => d.id)
      .attr('d', d => line(d.hist))
    .enter()
      .append('g')
      .attr('class', 'worldline')
      .append('path')
      .attr('d', d => line(d.hist))
      .attr('stroke', '#ccc')
      .attr('fill', 'transparent');
  return frame;
}

// Given an instant in some particle's worldline. Find how that instant looks  in
// the reference frame of another particle at a certain time in the life of that
// particle. Returns a transformed instant.
function transform (instant, particle, time) {
  // search world line of particle until we reach an event that occurs either now
  // or in the "past" (when the particle's age/clock was smaller than the time
  // provided). This event is the origin of the particle's current reference frame.
  let origin = particle.worldline.reduce( (prev, curr) =>
    curr.clock <= time ? curr : prev);

  // get e-prime: shift coordinates and apply Lorentz boost 
  let e_pr = boost(instant.e.x - origin.e.x, instant.e.t - origin.e.t, origin.v);

  // get v-prime: relativisitc velocity transformation
  let v_pr = (instant.v - origin.v) / (1 - instant.v * origin.v)

  // This is how the instant appears in the particle's reference frame, when the
  // particle is at the given time in it's own frame.
  return { v: v_pr, e: e_pr, clock: instant.clock }
}

// Lorentz boost with c = 1
function boost (x, t, v) {
  let gamma = 1 / Math.sqrt(1 - v * v)    // Lorentz factor
  return {x: (x - v * t) * gamma, t: (t - v * x) * gamma}
}

function update () {
  // advance state; update clock, frame, particle, lines, and queue
  update.state = advance_state(update.state);
}

function advance_state (state) {
  let clock = state.clock + clock_speed;  // increment clock

  // get particle that corresponds to viewer's reference frame (given by id)
  let particles = state.particles;
  let id = state.id;
  let particle_ref = particles.find( particle => particle.id == id );

  // TODO: look at event queue and create new events
  let queue = state.queue;

  // Travel along the worldline of each particle, transforming each event into
  // the viewer's reference frame. For each particle, grab the most recent
  // transformed event (where the t coordinate is less than or equal to the current
  // clock). Then use that transformed event to find the x position of particle
  let particles_coords = particles.map( particle => {
    return {
      id: particle.id,
      instant: particle.worldline.reduce( (prev, curr) =>
        transform(curr, particle_ref, clock).e.t <= clock ? curr : prev)
    }
  }).map( reduced_particle => {
    // transform particle into the viewer's reference frame
    let instant = reduced_particle.instant
    let instant_p = transform(instant, particle_ref, clock);

    // calculate delta t between recent instant and current time. then find current
    // position of particle.
    let delta_t = clock - instant_p.e.t;

    return {
      id: reduced_particle.id, 
      x: instant_p.e.x + instant_p.v * delta_t,
      t: 0
    }
  });

  // calculate worldlines
  let lines = particles_coords.map( particle => {
    // get x-coordinate of particle at t=clock for the viewer
    let x = particles_coords.find( p => p.id == particle.id).x;

    // shift t-coordinates downwards, add new coordinate for current position,
    // and remove first element if the array is too long. If history is empty for
    // that particle, start it now.
    let max_points = 30;
    return {
      id: particle.id,
      hist: (() => {
        let old = state.lines.find( p => p.id == particle.id );
        if (old)
          return ( old.hist
            .map(a => { return {x: a.x, t: a.t - clock_speed}; })
            .concat({x: x, t: 0})
            .slice(old.hist.length > max_points ? 1 : 0) )
        return [ {x: x, t: 0} ]
      })()
    }
  });

  // render objects and worldlines to frame using x and t scales
  /*
  let frame = render_worldlines(
    render_particles(state.frame, particles_coords, x, t), lines, line);*/
  let frame = render_particles(state.frame, particles_coords, x, t);
  frame = render_worldlines(frame, lines, line);

  return {id: id, clock: clock, frame: frame, particles: particles, lines: lines,
    queue: queue};

}


/* Returns a function with a cache for memoization. Programs written in a
 * functional style are stateless, so a given set of inputs to a function will
 * always return the same output, regardless of when/where the functiona is called.
 * Memoizing the results helps boost performance, since we don't have to run the
 * computation a second time if we've already done it once.
 */
function memoize (fn) {
  return function memoized (...args) {
    let hash = JSON.stringify(args);
    let cache = memoized.cache;
    // if result exists, return it. otherwise compute and store in cache.
    return cache[hash] || (cache[hash] = fn.call(...args));
  }
  memoized.cache = {};  // initialize empty cache
}

// where is the particle (in the program's reference frame) when it is age seconds
// old in the particle reference frame.

/* Given an event in a particle's worldline, how much time has elapsed in the life
 * of that particle?
 * In: Particle of interest; index of event in particle's worldline
 * Out: Age of particle (in it's own time) at that event
 */
let get_age_at_event = memoize (function fn (particle, index) {
  // If this is the first event in the worldline, we return zero. Otherwise, we
  // calculate delta x and delta t (from the last event to this event) and
  // compute t prime. We add this to the particle's age at the last event.
  
  if (index == 0) return 0;   // base case
  // TODO handle case where index is invalid

  let delta_t = particle[index].t - particle[index-1].t;
  let velocity = particle[index-1].v;
  let delta_x = velocity * delta_t;
  
  return fn(particle, index - 1) + lorentz_t(delta_x, delta_t, velocity);
});



/* ***************************************************************************** */

// set scale and create a line generator. 'line' will generate path data in
// display coordinates when given an array in minkowski coordinates.
let [x, t] = set_scale(x0, y0, x1, y1);
let line = d3.svg.line()
    .x( d => x(d.x) )
    .y( d => t(d.t) );

window.onload = function() {

// get svg object representing user's reference frame
let frame = d3.select('svg#frame');
set_frame_width(frame, x0 * 2, y0 * 2);

draw_axes(frame, line);

// create particle with one instant in worldline
let particle = {id: 0, worldline: [ {v: 0, e: {x: 0, t: 0}, clock: 0} ]};
let particle_b = {id: 1, worldline: [ {v: -0.2, e: {x: -0.2, t: 0}, clock: 0} ]};
let particle_c = {id: 2, worldline: [
  {v: 0.2, e: {x: 0, t: 0}, clock: 0},
  {v: -0.3, e: {x: 0.4, t: 2}, clock: 0} ]};
let particle_d = {id: 3, worldline: [
  {v: 0, e: {x: 0.2, t: 0}, clock: 0},
  {v: 0, e: {x: 10, t: 0.2}, clock: 0} ]};
let particles = [ particle, particle_c ];

// set initial state, and begin to travel through worldline of particle
update.state = {id: 0, clock: 0, frame: frame, particles: particles, lines: [],
  queue: []};
window.setInterval(update, update_interval);

};

/*

A particle looks like this:

particle = {
  id: particle_id,
  worldline: [
    { v: velocity_in_R, e: coords_in_R, clock: age_of_particle },
    { v: velocity_in_R, e: coords_in_R, clock: age_of_particle },
    { v: velocity_in_R, e: coords_in_R, clock: age_of_particle } ...
  ]
}

This is essentially the particle's world line. Each element in the list is a
different instant in the life of that particle.

- e is the event in the coordinates of R, the stationary reference frame.
- v is the velocity of the particle relative to R, at that particular instant.
- clock is the age of the particle (how it experiences time at that event)

So for the user, the general viewing pattern looks like this:
1. Increment clock.
2. Create new event for user if necessary (user just tried to change velocity)
    and add to worldline of particle.
3. Travel along worldline of each particle, transforming each event into the viewer
    reference frame. Look at the most recent transformed event. Grab the 
    transformed velocity and figure out where the particle should be plotted.
4. Plot particles! aaaaand we're done.

*/
