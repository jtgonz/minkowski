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

// create objects and add objects to world
let objects = [
  {x:0, t:0, id:0}, {x:0.7, t:0, id:1}, {x:-0.2, t:0, id:2}, {x:-0.5, t:0, id:3}
];
//place_object();

//update_objects(objects)
render_objects(frame, objects, x, t);


};