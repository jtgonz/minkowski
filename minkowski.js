"use strict"

// define (0,0) and (1,1) in terms of display coordinates 
let [x0, y0, x1, y1] = [200, 200, 400, 0];

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

function render_objects (frame, objects, x, t) {
  return frame.selectAll('.object')
      .data(objects, d => d.id)
      .attr('transform', d => 'translate(' + x(d.x) + ',' + t(d.t) + ')')
    .enter()
      .append('g')
      .attr('class', 'object')
      .attr('transform', d => 'translate(' + x(d.x) + ',' + t(d.t) + ')')
      .append('circle')
      .attr('transform', 'translate(0, -10)')
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 10)
      .style("fill", 'black');
}

// Given an instant in some particle's worldline. Find how that instant looks  in
// the reference frame of another particle at a certain time in the life of that
// particle. Returns a transformed instant.
function transform (instant, particle, time)
  // search world line of particle until we reach an event that occurs either now
  // or in the "past" (when the particle's age/clock was smaller than the time
  // provided). This event is the origin of the particle's current reference frame.
  let origin = particle.reduce( (prev, curr) => curr.clock <= time ? curr : prev)

  // get e-prime: shift coordinates and apply Lorentz boost 
  let e_pr = boost(instant.e.x - origin.e.x, instant.e.t - origin.e.t, origin.v);

  // get v-prime: relativisitc velocity transformation
  let v_pr = (instant.v - origin.v) / (1 - instant.v * origin.v)

  // This is how the instant appears in the particle's reference frame, when the
  // particle is at the given time in it's own frame.
  return { v: v_prime, e: e_prime, clock: instant.clock }
}

// Lorentz boost with c = 1
function boost (x, t, v) {
  let gamma = 1 / Math.sqrt(1 - v * v)    // Lorentz factor
  return {x: (x - v * t) * gamma, t: (t - v * x) * gamma}
}


/* ***************************************************************************** */

window.onload = function() {

// get svg object representing user's reference frame
let frame = d3.select('svg#frame');
set_frame_width(frame, x0 * 2, y0 * 2);

// set scale and create a line generator. 'line' will generate path data in
// display coordinates when given an array in minkowski coordinates.
let [x, t] = set_scale(x0, y0, x1, y1);
let line = d3.svg.line()
    .x( d => x(d.x) )
    .y( d => t(d.t) );

draw_axes(frame, line);

};

/*

A particle looks like this:

particle = [
  { v: velocity_in_R, e: coords_in_R, clock: age_of_particle },
  { v: velocity_in_R, e: coords_in_R, clock: age_of_particle },
  { v: velocity_in_R, e: coords_in_R, clock: age_of_particle } ...
]

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
