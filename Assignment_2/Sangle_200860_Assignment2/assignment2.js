
var gl;
var canvas;

var buf;
var indexBuf;
var cubeNormalBuf;

var aPositionLocation;
var uColorLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;
var uNormalLocation;
var uLightPosition;
var uSpecularColorLocation;
var uAmbientColorLocation;

var spBuf;
var spIndexBuf;
var spNormalBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var degree01 = 0.0;
var degree00 = 0.0;
var degree11 = 0.0;
var degree10 = 0.0;
var degree21 = 0.0;
var degree20 = 0.0;

var cameraDepth = 0;

var prevMouseX = 0.0;
var prevMouseY = 0.0;

var prevScene = 0;
var currScene = 0;

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix

var matrixStack = [];      // we use matrix stack for hierarchical modelling

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];
var lightPosition = [10.0,4,4.0];

var specColor = [1.0, 1.0, 1.0, 1.0];
var ambColor = [0.2, 0.2, 0.2, 1.0];	
var uDiffuseColor = [1.0, 1.0, 1.0, 1.0];

// Vertex shader code for per face lighting
var vertexShaderCodePerFace = `#version 300 es
in vec3 aPosition;
out vec3 posInEyeSpace;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;


void main() {
  mat4 projectionModelView;
	projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  posInEyeSpace = vec3(uVMatrix*uMMatrix*vec4(aPosition,1.0));
  gl_PointSize=2.0;
}`;

// Fragment shader code for per face lighting
var fragmentShaderCodePerFace = `#version 300 es
  precision mediump float;
  out vec4 fragColor;
  in vec3 posInEyeSpace;
  uniform vec4 uDiffuseColor;
  uniform vec3 uLightPosition;
  uniform vec4 ambColor;	
  uniform vec4 specColor;	
  
  void main() {
    vec3 normal = normalize(cross(dFdx(posInEyeSpace), dFdy(posInEyeSpace)));
    vec3 lightColor = vec3(1.0, 1.0, 1.0);
    vec3 lightVector = normalize(uLightPosition - posInEyeSpace);
    vec3 reflectVector = normalize(-reflect(lightVector, normal));
    vec3 viewVector = normalize(-posInEyeSpace);
    float costheta = max(dot(lightVector, normal), 0.0);
    float cosalpha = max(dot(reflectVector, viewVector), 0.0);
    fragColor = uDiffuseColor * costheta + specColor*pow(cosalpha, 32.0) + ambColor;	
  }`;


// Vertex shader code for per vertex lighting
var vertexShaderCodePerVertex = `#version 300 es
  precision highp float;
  in vec3 aPosition;
  in vec3 aNormal;

  uniform vec4 uDiffuseColor;
  uniform vec3 uLightPosition;
  uniform mat4 uMMatrix;
  uniform mat4 uPMatrix;
  uniform mat4 uVMatrix;
  uniform vec4 ambColor;	
  uniform vec4 specColor;	

  out vec4 vertexColor;

  void main() {
    mat4 projectionModelView = uPMatrix*uVMatrix*uMMatrix;
    mat3 normalTransformationMatrix = transpose(inverse(mat3(uVMatrix*uMMatrix)));
    vec3 transformedNormal = normalize(normalTransformationMatrix*aNormal);

    vec3 posInEyeSpace = vec3(uVMatrix*uMMatrix*vec4(aPosition,1.0));
    vec3 lightVector = normalize(uLightPosition - posInEyeSpace);
    vec3 reflectVector = normalize(-reflect(lightVector, transformedNormal));
    vec3 viewVector = normalize(-posInEyeSpace);
    float costheta = max(dot(lightVector, transformedNormal), 0.0);
    float cosalpha = pow(max(dot(reflectVector, viewVector), 0.0), 32.0);

    vertexColor = ambColor + specColor*cosalpha + uDiffuseColor*costheta;
    gl_Position = projectionModelView*vec4(aPosition,1.0);
    gl_PointSize=2.0;
  }`;

// Fragment shader code for per vertex lighting
var fragShaderCodePerVertex = `#version 300 es
precision highp float;
in vec4 vertexColor;
out vec4 fragColor;

void main() {
  fragColor = vertexColor;
}`;

// Vertex shader code
var vertexShaderCodePerFragment = `#version 300 es
  in vec3 aPosition;
  in vec3 aNormal;

  out vec3 normalVector;
  out vec3 posInEyeSpace;
  out vec3 viewDirection;
  out vec3 lightVector;

  uniform vec3 uLightPosition;
  uniform mat4 uMMatrix;
  uniform mat4 uPMatrix;
  uniform mat4 uVMatrix;

  void main() {
    posInEyeSpace = vec3(uVMatrix*uMMatrix*vec4(aPosition,1.0));
    normalVector = normalize(mat3(uVMatrix*uMMatrix)*aNormal);
    lightVector = normalize(uLightPosition - posInEyeSpace);
    viewDirection = normalize(-posInEyeSpace);
    gl_Position = uPMatrix*uVMatrix*uMMatrix*vec4(aPosition,1.0);
  }`;

// Fragment shader code
var fragShaderCodePerFragment = `#version 300 es
precision mediump float;

in vec3 normalVector;
in vec3 posInEyeSpace;
in vec3 viewDirection;
in vec3 lightVector;

out vec4 fragColor;

uniform vec4 uDiffuseColor;
uniform vec4 ambColor;	
uniform vec4 specColor;	

void main() {
  vec3 reflectVector = normalize(-reflect(lightVector, normalVector));
  float costheta = max(dot(lightVector, normalVector), 0.0);
  float cosalpha = pow(max(dot(reflectVector, viewDirection), 0.0), 32.0);
  fragColor = uDiffuseColor * costheta + specColor*cosalpha + ambColor;
}`;

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

function initShaders(vertexShaderCode, fragShaderCode) {
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

function resetMatrices(){
  mat4.identity(vMatrix);
  mat4.identity(pMatrix);
  mat4.identity(mMatrix);
}

function inWhichScene(x,y){
  var canvaWidth = gl.viewportWidth/3;
  if(x>=0 && x<=canvaWidth && y<=canvaWidth && y>=0) return 1;
  else if(x>=canvaWidth && x<=2*canvaWidth && y<=canvaWidth && y>=0) return 2;
  else if(x>=2*canvaWidth && x<=3*canvaWidth && y<=canvaWidth && y>=0) return 3;
  else return 0;
}

function setAttributes(){
  //get locations of attributes and uniforms declared in the shader
  aPositionLocation = gl.getAttribLocation(shaderProgram,  "aPosition");
  uMMatrixLocation  = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uVMatrixLocation  = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uPMatrixLocation  = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uColorLocation    = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
  uNormalLocation   = gl.getAttribLocation(shaderProgram,  "aNormal");
  uLightPosition    = gl.getUniformLocation(shaderProgram, "uLightPosition");
  uAmbientColorLocation = gl.getUniformLocation(shaderProgram, 'ambColor');
  uSpecularColorLocation = gl.getUniformLocation(shaderProgram, 'specColor');
  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(uNormalLocation);

}

function pushMatrix(m) {
  var copy = mat4.create(m);
  matrixStack.push(copy);
}

function popMatrix() {
  if (matrixStack.length > 0) return matrixStack.pop();
  else console.log("stack has no matrix to pop!");
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

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function initSphere(nslices, nstacks, radius) {
  var theta1, theta2;

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(-radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(-1.0);
    spNormals.push(0);
  }

  for (j = 1; j < nstacks - 1; j++) {
    theta1 = (j * 2 * Math.PI) / nslices - Math.PI / 2;
    for (i = 0; i < nslices; i++) {
      theta2 = (i * 2 * Math.PI) / nslices;
      spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
      spVerts.push(radius * Math.sin(theta1));
      spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));

      spNormals.push(Math.cos(theta1) * Math.cos(theta2));
      spNormals.push(Math.sin(theta1));
      spNormals.push(Math.cos(theta1) * Math.sin(theta2));
    }
  }

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(1.0);
    spNormals.push(0);
  }

  // setup the connectivity and indices
  for (j = 0; j < nstacks - 1; j++)
    for (i = 0; i <= nslices; i++) {
      var mi = i % nslices;
      var mi2 = (i + 1) % nslices;
      var idx = (j + 1) * nslices + mi;
      var idx2 = j * nslices + mi;
      var idx3 = j * nslices + mi2;
      var idx4 = (j + 1) * nslices + mi;
      var idx5 = j * nslices + mi2;
      var idx6 = (j + 1) * nslices + mi2;

      spIndicies.push(idx);
      spIndicies.push(idx2);
      spIndicies.push(idx3);
      spIndicies.push(idx4);
      spIndicies.push(idx5);
      spIndicies.push(idx6);
    }
}

function initSphereBuffer() {
  var nslices = 30; // use even number
  var nstacks = nslices / 2 + 1;
  var radius = 0.7;
  initSphere(nslices, nstacks, radius);

  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = nslices * nstacks;

  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = nslices * nstacks;

  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
}

function initCubeBuffer() {
  var vertices = [
    // Front face
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // Top face
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Bottom face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right face
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // Left face
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  ];
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  buf.itemSize = 3;
  buf.numItems = vertices.length / 3;

  var normals = [
    // Front face
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    // Back face
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    // Top face
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    // Bottom face
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    // Right face
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    // Left face
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];
  cubeNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  cubeNormalBuf.itemSize = 3;
  cubeNormalBuf.numItems = normals.length / 3;

  var indices = [
    0,
    1,
    2,
    0,
    2,
    3, // Front face
    4,
    5,
    6,
    4,
    6,
    7, // Back face
    8,
    9,
    10,
    8,
    10,
    11, // Top face
    12,
    13,
    14,
    12,
    14,
    15, // Bottom face
    16,
    17,
    18,
    16,
    18,
    19, // Right face
    20,
    21,
    22,
    20,
    22,
    23, // Left face
  ];
  indexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );
  indexBuf.itemSize = 1;
  indexBuf.numItems = indices.length;
}

function drawCube(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(
    aPositionLocation,
    buf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);

  gl.vertexAttribPointer(
    uNormalLocation,
    cubeNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);

  gl.uniform4fv(uColorLocation, color);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  gl.uniform3fv(uLightPosition, lightPosition);
  gl.uniform4fv(uAmbientColorLocation, ambColor);	
  gl.uniform4fv(uSpecularColorLocation, specColor);

  gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  // gl.drawArrays(gl.LINE_STRIP, 0, buf.numItems); // show lines
  // gl.drawArrays(gl.POINTS, 0, buf.numItems);  // show points
}

function drawSphere(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    spBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);

  gl.vertexAttribPointer(
    uNormalLocation,
    spNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  gl.uniform4fv(uColorLocation, color);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  gl.uniform3fv(uLightPosition, lightPosition);
  gl.uniform4fv(uAmbientColorLocation, ambColor);	
  gl.uniform4fv(uSpecularColorLocation, specColor);	

  gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
  // gl.drawArrays(gl.LINE_STRIP, 0, spBuf.numItems); // show lines
  // gl.drawArrays(gl.POINTS, 0, spBuf.numItems); // show points
}

function drawFirstScene() {
  resetMatrices();
  gl.clearColor(0.85, 0.85, 0.95, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  mMatrix = mat4.rotate(mMatrix, degToRad(degree00+30), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree01+15), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree01+7), [0, 0, 1]);
  
  mMatrix = mat4.scale(mMatrix, [0.45, 0.45, 0.45]);
  mMatrix = mat4.translate(mMatrix, [0, 1, 0]);
  drawSphere([1/255, 111/255, 163/255, 1.0]);
  
  mMatrix = mat4.scale(mMatrix, [1,1.8,1]);
  mMatrix = mat4.translate(mMatrix, [0, -0.89, 0]);
  drawCube([169/255, 170/255, 113/255, 1.0]);
}

function drawSecondScene(){
  resetMatrices();
  gl.clearColor(0.95, 0.85, 0.85, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  mMatrix = mat4.rotate(mMatrix, degToRad(degree10-19.5), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree11-5.6), [1, 0, 0]);
  
  var sphereColor = [106/255, 106/255, 106/255, 1.0]; // specify color for the cube
  var cubeColor = [0/255, 120/255, 0/255, 1.0];

  mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
  mMatrix = mat4.translate(mMatrix, [0, -1, 0]);
  drawSphere(sphereColor);
  
  mMatrix = mat4.scale(mMatrix, [0.7,0.7,0.7]);
  mMatrix = mat4.translate(mMatrix, [-1.05, 1.05, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(45), [0, 0, 1]);
  drawCube(cubeColor);
  
  mMatrix = mat4.scale(mMatrix, [0.7,0.7,0.7]);
  mMatrix = mat4.translate(mMatrix, [1.35, 0.0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-10), [-1, -1, 1]);
  drawSphere(sphereColor);

  mMatrix = mat4.scale(mMatrix, [1.0,1.0,1.0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(5), [0, 0, 1]);
  mMatrix = mat4.translate(mMatrix, [1.20,0, 0]);
  drawCube(cubeColor);

  mMatrix = mat4.scale(mMatrix, [0.7,0.7,0.7]);
  mMatrix = mat4.translate(mMatrix, [0,1.4, 0]);
  drawSphere(sphereColor);

}

function thirdSceneUtil(color1, color2, color3){
  var color = [0.5, 0, 0, 1]; // specify color for the cube

  mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);
  mMatrix = mat4.translate(mMatrix, [-2, -1.95, 0]);
  drawSphere(color1);
  
  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [2, 0.2, 4]);
  mMatrix = mat4.translate(mMatrix, [0, 4, 0]);
  drawCube(color2);
  
  mMatrix = popMatrix();
  mMatrix = mat4.translate(mMatrix, [0, 1.6, 0]);
  drawSphere(color3);
}

function drawThirdScene(){
  resetMatrices();
  gl.clearColor(0.85, 0.95, 0.85, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  mMatrix = mat4.translate(mMatrix, [0, 0.2, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree20+31.4), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree21+6.0), [1, 0, 0]);
  console.log(degree20, degree21);  

  pushMatrix(mMatrix);
  mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 0.25]);
  mMatrix = mat4.translate(mMatrix, [0, -3, 0]);
  drawSphere([1/255, 87/255, 33/255, 1.0]);
  
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 4.15, 0]);
  drawSphere([114/255, 113/255, 146/255, 1.0]);

  mMatrix = popMatrix();
  mMatrix = mat4.scale(mMatrix, [5, 0.2, 1]);
  mMatrix = mat4.translate(mMatrix, [0, 4, 0]);
  drawCube([166/255, 55/255, 19/255, 1.0]);
  
  mMatrix = mat4.translate(mMatrix, [0, 12.8, 0]);
  drawCube([166/255, 55/255, 19/255, 1.0]);

  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  thirdSceneUtil([85/255, 85/255, 184/255, 1.0], [170/255, 169/255, 0/255, 1.0], [163/255, 0/255, 163/255, 1.0]);
  mMatrix = popMatrix();
  
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.8,0,0]);
  thirdSceneUtil([32/255, 108/255, 127/255, 1.0], [42/255, 152/255, 118/255, 1.0], [137/255, 95/255, 28/255, 1.0]);
  mMatrix = popMatrix();

}

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  
  // turn on scissor test
  gl.enable(gl.SCISSOR_TEST);

  // initialize shader program
  shaderProgram = initShaders(vertexShaderCodePerFace, fragmentShaderCodePerFace);
  setAttributes();
  gl.clearColor(0.85, 0.85, 0.95, 1.0);
  gl.viewport(0, 0, gl.viewportWidth/3, gl.viewportHeight);
  gl.scissor(0, 0, gl.viewportWidth/3, gl.viewportHeight);
  drawFirstScene();
  
  shaderProgram = initShaders(vertexShaderCodePerVertex, fragShaderCodePerVertex);
  setAttributes();
  gl.viewport(gl.viewportWidth/3, 0, gl.viewportWidth/3, gl.viewportHeight);
  gl.scissor(gl.viewportWidth/3, 0, gl.viewportWidth/3, gl.viewportHeight);
  drawSecondScene();

  shaderProgram = initShaders(vertexShaderCodePerFragment, fragShaderCodePerFragment);
  setAttributes();
  gl.viewport(2*gl.viewportWidth/3, 0, gl.viewportWidth/3, gl.viewportHeight);
  gl.scissor(2*gl.viewportWidth/3, 0, gl.viewportWidth/3, gl.viewportHeight);
  drawThirdScene();

}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);
  prevScene = inWhichScene(prevMouseX, prevMouseY);

  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
    prevScene = inWhichScene(prevMouseX, prevMouseY);
  }
}

function onMouseMove(event) {
  // make mouse interaction only within canvas
  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    var mouseX = event.clientX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;
    
    var mouseY = canvas.height - event.clientY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;
    
    currScene = inWhichScene(mouseX, mouseY);
    if (currScene == 1 && prevScene == 1) {
      degree00 = degree00 + diffX1 / 5;
      degree01 = degree01 - diffY2 / 5;
    }
    else if (currScene == 2  && prevScene == 2) {
      degree10 = degree10 + diffX1 / 5;
      degree11 = degree11 - diffY2 / 5;
    }
    else if (currScene == 3  && prevScene == 3) {
      degree20 = degree20 + diffX1 / 5;
      degree21 = degree21 - diffY2 / 5;
    }
    drawScene();
  }
}

function onMouseUp(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function changeLightPosition(value){
  lightPosition[0] = value*2.0;
  drawScene();
}

function changeCameraPosition(value){
  eyePos = [0, 0, 2.0+value/10.0];
  drawScene();
} 

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("assignment2");
  document.addEventListener("mousedown", onMouseDown, false);

  // initialize WebGL
  initGL(canvas);

  //initialize buffers for the square
  initCubeBuffer();
  initSphereBuffer();

  gl.enable(gl.DEPTH_TEST);
  drawScene();
}
