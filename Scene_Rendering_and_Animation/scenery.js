////////////////////////////////////////////////////////////////////////
// A simple WebGL program to draw simple 2D shapes with animation.
//

var gl;
var color;
var animation;
var degree0 = 0;
var degree1 = 0;
var matrixStack = [];
var translate = 0;
var mode = 2;
var rotate = 0;
var resolution = 60;
var speed = 1;
var paused = 1;

// mMatrix is called the model matrix, transforms objects
// from local object space to world space.
var mMatrix = mat4.create();
var uMMatrixLocation;
var aPositionLocation;
var uColorLoc;

var sqVertexPositionBuffer;
var circleVertexPositionBuffer;
var triangleVertexPositionBuffer;

var circleVertexIndexBuffer;

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
  gl_Position = uMMatrix*vec4(aPosition,0.0,1.0);
  gl_PointSize = 2.0;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform vec4 color;

void main() {
  fragColor = color;
}`;


function pushMatrix(m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  matrixStack.push(copy);
}

function popMatrix() {
  if (matrixStack.length > 0) return matrixStack.pop();
  else console.log("stack has no matrix to pop!");
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function initCircleBuffer() {
  // buffer for point locations
  let circleVertices = [0,0], circleIndices = [];
  let angle = 0, radius = 0.9;
  for(let i=1;i<=resolution;i++){
    circleVertices.push(radius*Math.cos(degToRad(angle)), radius*Math.sin(degToRad(angle)));
    angle += 360/resolution;
    circleIndices.push(0, i, i+1);
  }
  circleIndices[circleIndices.length-1] = 1;
  circleVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, circleVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW);
  circleVertexPositionBuffer.itemSize = 2;
  circleVertexPositionBuffer.numItems = circleVertices.length/2;

  // buffer for point indices
  circleVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(circleIndices), gl.STATIC_DRAW);
  circleVertexIndexBuffer.itemsize = 1;
  circleVertexIndexBuffer.numItems = resolution*3;

}

function drawCircle(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, circleVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    circleVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.uniform4fv(uColorLoc, color);

    
  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleVertexIndexBuffer);
  
  // now draw the square
  gl.drawElements(
    mode ===0 ? gl.POINTS : mode === 1 ? gl.LINE_LOOP : gl.TRIANGLES,
    resolution*3,
    gl.UNSIGNED_SHORT,
    0
  );

  // gl.drawArrays(
  //   mode ===0 ? gl.POINTS : mode === 1 ? gl.LINE_LOOP : gl.TRIANGLE_FAN,
  //   0,
  //   circleVertexPositionBuffer.numItems,
  // );
}

function initSquareBuffer() {
  // buffer for point locations
  const sqVertices = new Float32Array([
    0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  ]);
  sqVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
  sqVertexPositionBuffer.itemSize = 2;
  sqVertexPositionBuffer.numItems = 4;
}

function drawSquare(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    sqVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.uniform4fv(uColorLoc, color);

  // now draw the square
  gl.drawArrays(
    mode ===0 ? gl.POINTS : mode === 1 ? gl.LINE_LOOP : gl.TRIANGLE_FAN,
    0,
    sqVertexPositionBuffer.numItems
  );
}

function initTriangleBuffer() {
  // buffer for point locations
  const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
  triangleVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
  triangleVertexPositionBuffer.itemSize = 2;
  triangleVertexPositionBuffer.numItems = 3;

}

function drawTriangle(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    triangleVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.uniform4fv(uColorLoc, color);

  // now draw the triangle
  gl.drawArrays(
    mode ===0 ? gl.POINTS : mode === 1 ? gl.LINE_LOOP : gl.TRIANGLES,
    0,
    triangleVertexPositionBuffer.numItems
  );
}

function drawSun(color, mMatrix){
  drawCircle(color, mMatrix);

  let raysVertices = [];
  let angle = 0, resolution = 8, radius = 1.4;
  for(let i=1;i<=resolution/2;i++){
    raysVertices.push(radius*Math.cos(degToRad(angle)), radius*Math.sin(degToRad(angle)));
    raysVertices.push(radius*Math.cos(degToRad(angle+180)), radius*Math.sin(degToRad(angle+180)));
    angle += 360/resolution;
  }
  var raysVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, raysVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(raysVertices), gl.STATIC_DRAW);
  raysVertexPositionBuffer.itemSize = 2;
  raysVertexPositionBuffer.numItems = raysVertices.length;

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, raysVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    raysVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.uniform4fv(uColorLoc, color);

  gl.drawArrays(
    gl.LINES,
    0,
    raysVertexPositionBuffer.numItems,
  );


}

function drawMountains(color, color1, mMatrix){
  mMatrix = mat4.translate(mMatrix, [-0.32, -0.45, 0.0]);
  mMatrix = mat4.scale(mMatrix, [0.7, 0.3, 0.0]);
  drawTriangle(color1, mMatrix);
  mMatrix = mat4.rotate(mMatrix, degToRad(5),[0.0, 0.0, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.65, 0.8, 0.0]);
  mMatrix = mat4.translate(mMatrix, [0.07, 0.1, 0.0]);
  drawTriangle(color, mMatrix);


  mMatrix = mat4.rotate(mMatrix, degToRad(-10),[0.0, 0.0, 0.1]);
  mMatrix = mat4.translate(mMatrix, [0.6, 0.2, 0.0]);
  mMatrix = mat4.scale(mMatrix, [1.2, 1.3, 0.0]);
  drawTriangle(color1, mMatrix);
  mMatrix = mat4.rotate(mMatrix, degToRad(10),[0.0, 0.0, 0.1]);
  mMatrix = mat4.scale(mMatrix, [1.6, 1.4, 0.0]);
  mMatrix = mat4.translate(mMatrix, [0.05, -0.15, 0.0]);
  drawTriangle(color, mMatrix);

  mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 0.0]);
  mMatrix = mat4.translate(mMatrix, [0.55, -0.15, 0.0]);
  drawTriangle(color, mMatrix);

}

function drawTree(mMatrix){
  drawSquare([121/255, 79/255, 78/255, 1.0], mMatrix);
  mMatrix = mat4.scale(mMatrix, [7,1.1,0]);
  mMatrix = mat4.translate(mMatrix, [0,0.7,0]);
  drawTriangle([67/255, 151/255, 85/255, 1.0], mMatrix);
  mMatrix = mat4.scale(mMatrix, [1.1,1.,0]);
  mMatrix = mat4.translate(mMatrix, [0,0.1,0]);
  drawTriangle([105/255, 177/255, 90/255, 1.0], mMatrix);
  mMatrix = mat4.scale(mMatrix, [1.05,1.,0]);
  mMatrix = mat4.translate(mMatrix, [0,0.1,0]);
  drawTriangle([128/255, 202/255, 95/255, 1.0], mMatrix);
}

function drawTrees(mMatrix){
  mMatrix = mat4.scale(mMatrix, [0.02, 0.25, 0.0]);
  mMatrix = mat4.translate(mMatrix, [20, -1.5, 0.0]);
  pushMatrix(mMatrix);
  drawTree(mMatrix);
  mMatrix = popMatrix();
  
  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [1.4, 1.5, 0.0]);
  mMatrix = mat4.translate(mMatrix, [-5, 0.15, 0.0]);
  pushMatrix(mMatrix);
  drawTree(mMatrix);
  mMatrix = popMatrix();
  mMatrix = popMatrix();

  mMatrix = mat4.translate(mMatrix, [-14, 0.0, 0.0]);
  pushMatrix(mMatrix);
  drawTree(mMatrix);
  mMatrix = popMatrix();

}

function drawBoat(mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0,0.6,0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.0, 0.0, 1.0]);
  mMatrix = mat4.scale(mMatrix, [0.005,1.3,0]);
  drawSquare([0,0,0,1], mMatrix);
  mMatrix = popMatrix();
  
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.035,0.7,0]);
  mMatrix = mat4.scale(mMatrix, [0.065,0.9,0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0.0, 0.0, 1.0]);
  drawTriangle([212/255, 88/255, 37/255, 1.0], mMatrix);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.025,0.55,0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-3), [0.0, 0.0, 1.0]);
  mMatrix = mat4.scale(mMatrix, [0.002,1.0,0]);
  drawSquare([0,0,0,1], mMatrix);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.07,0.25,0]);  
  drawSquare([204/255, 204/255, 204/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.5,0,0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0.0, 0.0, 1.0]);
  drawTriangle([204/255, 204/255, 204/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [-1,0,0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.0, 0.0, 1.0]);
  drawTriangle([204/255, 204/255, 204/255, 1.0], mMatrix);
  mMatrix = popMatrix();
}

function drawWaterLines(mMatrix){
  pushMatrix(mMatrix);
  
  mMatrix = mat4.translate(mMatrix, [0,0.3,0]);
  mMatrix = mat4.scale(mMatrix, [0.2,0.02,0]);
  drawSquare([116/255, 158/255, 237/255, 1.0], mMatrix);
  
  mMatrix = mat4.translate(mMatrix, [1.5,-30,0]);
  drawSquare([116/255, 158/255, 237/255, 1.0], mMatrix);

  mMatrix = mat4.translate(mMatrix, [-3.2,15,0]);
  drawSquare([116/255, 158/255, 237/255, 1.0], mMatrix);
  
  mMatrix = popMatrix();
}

function drawRiver(color, mMatrix){
  mMatrix = mat4.scale(mMatrix, [1,0.2,0]);
  mMatrix = mat4.translate(mMatrix, [0,1.8,0]);
  drawSquare(color, mMatrix);
  
  drawWaterLines(mMatrix);
  
  mMatrix = popMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [1,0.2,0]);
  mMatrix = mat4.translate(mMatrix, [translate,1.8,0]);
  drawBoat(mMatrix);

}

function drawATurbine(mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.04,0.6,0]);
  drawSquare([51/255, 51/255, 51/255, 1.0], mMatrix);
  mMatrix = popMatrix();
  
  for(let i=0;i<4;i++){
    pushMatrix(mMatrix);
    mMatrix = mat4.translate(mMatrix, [0,0.3,0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(i*90+rotate), [0.0, 0.0, 1.0]);
    mMatrix = mat4.translate(mMatrix, [0,-0.1,0]);
    mMatrix = mat4.scale(mMatrix, [0.05,0.3,0]);
    drawTriangle([179/255, 179/255, 57/255, 1.0], mMatrix);
    mMatrix = popMatrix();
  }

  mMatrix = mat4.translate(mMatrix, [0,0.3,0]);
  mMatrix = mat4.scale(mMatrix, [0.03,0.03,0]);
  drawCircle([0,0,0,1], mMatrix);
}

function drawTurbines(mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.6,0.3,0]);
  drawATurbine(mMatrix);
  mMatrix = popMatrix();
  
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.35,0.3,0]);
  drawATurbine(mMatrix);
  mMatrix = popMatrix();
  
}

function drawRoad(color, mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.6,-0.9,0]);
  mMatrix = mat4.scale(mMatrix, [0.70,1.4,0]);

  mMatrix = mat4.rotate(mMatrix, degToRad(45), [0,0,1]);
  mMatrix = mat4.scale(mMatrix, [2.5,2.5,0]);

  drawTriangle(color, mMatrix);
  mMatrix = popMatrix();
}

function drawGrasses(mMatrix){
  let color1 = [80/255, 176/255, 51/255, 1.0];  //50b033
  let color2 = [67/255, 151/255, 42/255, 1.0];  //43972a
  let color3 = [42/255, 100/255, 25/255, 1.0];  //2a6419

  mMatrix = mat4.scale(mMatrix, [0.099,0.05,0]);
  mMatrix = mat4.translate(mMatrix, [-10,-12,0]);
  drawCircle(color1, mMatrix);
  
  mMatrix = mat4.scale(mMatrix, [1.3,1.6,0]);
  mMatrix = mat4.translate(mMatrix, [1.2,0.2,0]);
  drawCircle(color2, mMatrix);

  mMatrix = mat4.scale(mMatrix, [1,1.1,0]);
  mMatrix = mat4.translate(mMatrix, [5,0,0]);
  drawCircle(color1, mMatrix);

  mMatrix = mat4.scale(mMatrix, [0.6,0.8,0]);
  mMatrix = mat4.translate(mMatrix, [3.5,0,0]);
  drawCircle(color3, mMatrix);

  mMatrix = mat4.scale(mMatrix, [2.0,1.3,0]);
  mMatrix = mat4.translate(mMatrix, [-0.95,0.07,0]);
  drawCircle(color2, mMatrix);

  mMatrix = mat4.scale(mMatrix, [0.5,0.8,0]);
  mMatrix = mat4.translate(mMatrix, [11.8,1.2,0]);
  drawCircle(color1, mMatrix);

  mMatrix = mat4.scale(mMatrix, [1.8,1.2,0]);
  mMatrix = mat4.translate(mMatrix, [1,0.1,0]);
  drawCircle(color2, mMatrix);

  mMatrix = mat4.scale(mMatrix, [0.7,1.0,0]);
  mMatrix = mat4.translate(mMatrix, [-11,-6.2,0]);
  drawCircle(color1, mMatrix);

  mMatrix = mat4.scale(mMatrix, [0.7,0.5,0]);
  mMatrix = mat4.translate(mMatrix, [6,0.5,0]);
  drawCircle(color3, mMatrix);

  mMatrix = mat4.scale(mMatrix, [3,3,0]);
  mMatrix = mat4.translate(mMatrix, [-1,-0.2,0]);
  drawCircle(color2, mMatrix);
}

function drawHouse(mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.7,0.5,0]);
  drawSquare([229/255, 229/255, 229/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, 1,0]);
  drawSquare([236/255, 91/255, 41/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [+0.5,0,0]);
  mMatrix = mat4.scale(mMatrix, [0.5,1,0]);
  drawTriangle([236/255, 91/255, 41/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [-2.0,0,0]);
  mMatrix = mat4.scale(mMatrix, [1,1,0]);
  drawTriangle([236/255, 91/255, 41/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [1,-1.17,0]);
  mMatrix = mat4.scale(mMatrix, [0.35,0.65,0]);
  drawSquare([221/255, 181/255, 61/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [1.8,0.5,0]);
  mMatrix = mat4.scale(mMatrix, [1,0.5,0]);
  drawSquare([221/255, 181/255, 61/255, 1.0], mMatrix);
  mMatrix = mat4.translate(mMatrix, [-3.5,0,0]);
  mMatrix = mat4.scale(mMatrix, [1,1,0]);
  drawSquare([221/255, 181/255, 61/255, 1.0], mMatrix);
  mMatrix = popMatrix();
}

function InvertedBoad(color, mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, 1,0]);
  drawSquare(color, mMatrix);
  mMatrix = mat4.translate(mMatrix, [+0.5,0,0]);
  mMatrix = mat4.scale(mMatrix, [0.5,1,0]);
  drawTriangle(color, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-2.0,0,0]);
  mMatrix = mat4.scale(mMatrix, [1,1,0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix();
}

function drawTyres(mMatrix){
  pushMatrix(mMatrix);
  
  mMatrix = mat4.scale(mMatrix, [0.07,0.07,0]);
  drawCircle([0,0,0,1], mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.8,0.8,0]);
  drawCircle([128/255,128/255,128/255,1.0], mMatrix);
  
  mMatrix = popMatrix();
}

function drawCar(mMatrix){
  pushMatrix(mMatrix);
  
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [-1,-1,0]);
  drawTyres(mMatrix);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.7,-1,0]);
  drawTyres(mMatrix);
  mMatrix = popMatrix();
  
  mMatrix = mat4.translate(mMatrix, [-0.85,-1.05,0]);
  mMatrix = mat4.scale(mMatrix, [0.4, 0.15,0]);
  InvertedBoad([55/255, 126/255, 222/255, 1.0], mMatrix);
  
  mMatrix = mat4.translate(mMatrix, [1,0.1,0]);
  mMatrix = mat4.scale(mMatrix, [1, 0.8,0]);
  InvertedBoad([191/255, 107/255, 83/255, 1.0], mMatrix);
  
  mMatrix = popMatrix();
}

function drawBird(color, mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0,0.5,0]);
  mMatrix = mat4.scale(mMatrix, [0.015,0.015,0]);
  drawSquare(color, mMatrix);
  mMatrix = popMatrix();
  
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.030,0.515,0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [0.0, 0.0, 1.0]);
  mMatrix = mat4.scale(mMatrix, [0.07,0.010,0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix();
  
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.030,0.515,0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-10), [0.0, 0.0, 1.0]);
  mMatrix = mat4.scale(mMatrix, [0.07,0.010,0]);
  drawTriangle(color, mMatrix);
  mMatrix = popMatrix();
}

function drawBirds(color, mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.15, 0.1, 0.0]);
  drawBird(color, mMatrix);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 0.0]);
  mMatrix = mat4.translate(mMatrix, [0.45, 0.5, 0.0]);
  drawBird(color, mMatrix);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 0.0]);
  mMatrix = mat4.translate(mMatrix, [-0.30, 0.35, 0.0]);
  drawBird(color, mMatrix);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.0]);
  mMatrix = mat4.translate(mMatrix, [-0.10, 1.05, 0.0]);
  drawBird(color, mMatrix);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.3, 0.3, 0.0]);
  mMatrix = mat4.translate(mMatrix, [0.30, 2.30, 0.0]);
  drawBird(color, mMatrix);
  mMatrix = popMatrix();
}

function drawClouds(color, mMatrix){
  pushMatrix(mMatrix);
  mMatrix = mat4.rotate(mMatrix, degToRad(-3), [0.0, 0.0, 1.0]);
  mMatrix = mat4.scale(mMatrix, [0.2, 0.1, 0.0]);
  mMatrix = mat4.translate(mMatrix, [-4.5, 5.5, 0.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix();
  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.15, 0.08, 0.0]);
  mMatrix = mat4.translate(mMatrix, [-4.5, 7, 0.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix();
  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [-0.1, 0.05, 0.0]);
  mMatrix = mat4.translate(mMatrix, [5, 11, 0.0]);
  drawCircle(color, mMatrix);
  mMatrix = popMatrix();  
}

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(1,1,1,1);

  // stop the current loop of animation if there is one
  if (animation) {
    window.cancelAnimationFrame(animation);
  }
  var direction = 1;
  var animate = function () {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    if(Math.round(translate*100)/100 == 0.61) {
      direction = -1;
    }
    if(Math.round(translate*100)/100 == -0.61){
      direction = +1;
    }

    translate += direction*0.001*speed*paused;
    rotate -= 0.5*speed*paused;

    // draw the sky
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.5, 0.0]);
    mMatrix = mat4.scale(mMatrix, [2, 1, 0.0]);
    drawSquare([128/255, 202/255, 250/255, 1.0], mMatrix);
    
    // draw the mountain
    pushMatrix(mMatrix);
    drawMountains([145/225, 121/225, 87/225, 1.0], [123/255, 94/255, 70/255,1], mMatrix);
    mMatrix = popMatrix();
    
    // draw the trees
    pushMatrix(mMatrix);
    drawTrees(mMatrix);
    mMatrix = popMatrix();

    // draw the ground
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    mMatrix = mat4.scale(mMatrix, [2, 1, 0.0]);
    drawSquare([104/255, 226/255, 138/255, 1.0], mMatrix);

    // drawing the road
    pushMatrix(mMatrix);
    drawRoad([120/255, 177/255, 72/255, 1.0], mMatrix);
    mMatrix = popMatrix();

    // draw the river
    pushMatrix(mMatrix);
    drawRiver([42/255, 100/255, 246/255, 1.0], mMatrix);
    // mMatrix = popMatrix();

    // draw the sun
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.7, 0.8, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-1*rotate), [0.0, 0.0, 1.0]);
    mMatrix = mat4.scale(mMatrix, [0.1,0.1,1]);
    drawSun([251/255, 230/255, 77/255, 1],  mMatrix);

    // draw the cloud
    mat4.identity(mMatrix);
    drawClouds([1,1,1,0], mMatrix);

    // drawing turbines
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0.0]);
    drawTurbines(mMatrix);

    // drawing grasses everywhere
    mat4.identity(mMatrix);
    drawGrasses(mMatrix);

    // drawing the house 
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.5, -0.53, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.8,0.6,1]);
    drawHouse(mMatrix);

    // drawing the car 
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.3, -0.3, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.8,0.6,1]);
    drawCar(mMatrix);

    // drawing the birds
    mat4.identity(mMatrix);
    drawBirds([0,0,0,1.0], mMatrix);

    animation = window.requestAnimationFrame(animate);
  };
  console.log(mode);
  animate();
}

// This is the entry point from the html
function webGLStart() {
  var canvas = document.getElementById("sceneryCanvas");
  initGL(canvas);
  shaderProgram = initShaders();

  //get locations of attributes declared in the vertex shader
  const aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);

  uColorLoc = gl.getUniformLocation(shaderProgram, "color");

  initSquareBuffer();
  initTriangleBuffer();
  initCircleBuffer();

  drawScene();
}

// Some Custom function used to communicated between DOM and Javascript

function TogglePointView(){
  mode = 0;
}

function ToggleWireframeView(){
  mode = 1;
}

function ToggleSolidView(){
  mode = 2;
}

function changeSpeed(value){
  speed = value/10;
}

function PauseAnimation(){
  const button = document.getElementById("pause-button");
  button.textContent = paused === 0 ? "Pause" : "Play";
  if(paused !== 0){
    button.style.backgroundColor = "#82d585";
    button.style.transform = "scale(1.1)";
  }
  else{
    button.style.backgroundColor = "#ffffff";
    button.style.transform = "scale(1.0)";
  }
  paused = 1 - paused;
}