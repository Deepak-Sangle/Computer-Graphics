///////////////////////////////////////////////////////////
//  A simple WebGL program to show how to load JSON model
//

var gl;
var canvas;
var matrixStack = [];

var zAngle = 0.0;
var yAngle = 0.0;

var prevMouseX = 0;
var prevMouseY = 0;
var aPositionLocation;
var aNormalLocation;
var aTextureLocation;
var uVMatrixLocation;
var uWNMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;
var uTextureLocation;
var u2DTextureLocation;
var uColorLocation;
var uIsCubeMapLocation;

var buf;
var cubeNormalBuf;
var indexBuf;

var spBuf;
var spIndexBuf;
var spNormalBuf;
var spTexBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];
var spTexCoords = [];

var objVertexPositionBuffer;
var objVertexNormalBuffer;
var objVertexIndexBuffer;
var objVertexTextureBuffer;

var cubeMapTexture;
var cubeTextureBuf;

var uEyePositionLocation;

var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix

var eyeMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];  // eye matrix to be used for camera
var speed = 0.2;
var color = [1.0,1.0,1.0];                      // not used but passed for completeness

// variables to manipulate the scene
var eyePos = [0.0, 2, 4.0];
var initialEyePos = [0.0, 2, 4.0];
var reflection = 0.6;

// Inpur JSON model file to load
var teapot_JSON = "public/teapot.json";

var cubeMapPath = "public/Nvidia_Cubemap/"
var posx, posy, posz, negx, negy, negz;
var posx_file, posy_file, posz_file, negx_file, negy_file, negz_file;

var rubixCube, rubixCube_file;
var wood, wood_file;

const vertexShaderReflection = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexture;

uniform mat4 uWNMatrix;
uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;

out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec3 v;
out vec3 n;
out vec2 t;

void main() {
  v_worldPosition =  mat3(uMMatrix) * aPosition;
  v_worldNormal = mat3(uWNMatrix) * aNormal;

  mat4 modelViewMatrix = uVMatrix * uMMatrix;
  v = vec3(modelViewMatrix * vec4(aPosition,1.0));
  n = vec3(transpose(inverse(modelViewMatrix)) * vec4(aNormal,1.0));
  t = aTexture;

  gl_Position =  uPMatrix*uVMatrix*uMMatrix * vec4(aPosition,1.0);
  gl_PointSize=1.0;
}`;

const fragShaderEnvironment = `#version 300 es
precision mediump float;

uniform vec3 uEyePos;
uniform samplerCube cubeMap;
uniform sampler2D cubeMap2D;
uniform vec3 uDiffuseColor;
uniform int uIsCubeMap;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v;
in vec3 n;
in vec2 t;

out vec4 fragColor;

void main() {
  // cubemap color or texture color computation
  vec3 worldNormal = normalize(v_worldNormal);
  vec3 eyeToSurfaceDir = normalize(v_worldPosition - uEyePos);
  vec3 directionReflection = reflect(eyeToSurfaceDir,worldNormal);
  if(uIsCubeMap == 2) directionReflection = refract(eyeToSurfaceDir,worldNormal,0.82);
  
  vec4 cubeMapReflectCol = texture(cubeMap, directionReflection);
  if(uIsCubeMap == 3) cubeMapReflectCol = texture(cubeMap2D, t);
  vec4 textureColor = vec4(0.0,0.0,0.0,1.0);
  if(uIsCubeMap == 4) textureColor = texture(cubeMap2D, t);

  // phong shading model computations
  vec3 lightPos = vec3(0.0, 0.0, 0.0);
  vec3 lightDir = normalize(lightPos - v);
  vec3 eyeDir = normalize(uEyePos - v);
  float costheta = max(dot(lightDir, worldNormal), 0.0);
  float cosalpha = max(dot(eyeDir, directionReflection), 0.0);
  vec3 Idiffuse = uDiffuseColor * costheta;  
  vec3 Ispecular = vec3(1.0, 1.0, 1.0) * pow(cosalpha, 32.0);
  vec3 Iambient = uDiffuseColor;

  vec3 phongColor = (Ispecular + Idiffuse + Iambient)*0.5;
  
  if(uIsCubeMap == 1 || uIsCubeMap == 2 || uIsCubeMap == 3) fragColor = cubeMapReflectCol;
  else if(uIsCubeMap == 4) fragColor = textureColor*cubeMapReflectCol*0.85;
  else fragColor = cubeMapReflectCol*${reflection} + vec4(phongColor, 1.0)*1.6;

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

function initShaders(vertexShaderCode, fragmentShaderCode) {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragmentShaderCode);

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

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function pushMatrix(m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  matrixStack.push(copy);
}

function popMatrix() {
  if (matrixStack.length > 0) return matrixStack.pop();
  else console.log("stack has no matrix to pop!");
}

// Helper function for my matrix multiplication
function myMatMul(a, b) {
  const result = [];
  // i know this function takes nx1 vector and nxn matrix
  for (let i = 0; i < b.length; i++) {
      let sum = 0;
      for (let j = 0; j < a.length; j++) {
        sum+=a[j]*b[i][j];
      }
      result.push(sum);
  }
  return result;
}

function initObject() {
  // XMLHttpRequest objects are used to interact with servers
  // It can be used to retrieve any type of data, not just XML.
  var request = new XMLHttpRequest();
  request.open("GET", teapot_JSON);
  // MIME: Multipurpose Internet Mail Extensions
  // It lets users exchange different kinds of data files
  request.overrideMimeType("application/json");
  request.onreadystatechange = function () {
    //request.readyState == 4 means operation is done
    if (request.readyState == 4) {
      processObject(JSON.parse(request.responseText));
    }
  };
  request.send();
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

  var cubeTexture = [
    0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
  ];
  cubeTexture = Array.from({length : 6}, ()=> [...cubeTexture]).flat();
  cubeTextureBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTextureBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeTexture), gl.STATIC_DRAW);
  cubeTextureBuf.itemSize = 2;
  cubeTextureBuf.numItems = cubeTexture.length / 2;

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
    aNormalLocation,
    cubeNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTextureBuf);
  gl.vertexAttribPointer(
    aTextureLocation,
    cubeTextureBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  
  gl.uniform3fv(uColorLocation, color);
  gl.uniform3fv(uEyePositionLocation, eyePos);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  gl.uniformMatrix4fv(uWNMatrixLocation, false, mat4.inverse(mat4.transpose(mMatrix)));

  gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

// New sphere initialization function
function initSphere(nslices, nstacks, radius) {
  for (var i = 0; i <= nslices; i++) {
    var angle = (i * Math.PI) / nslices;
    var comp1 = Math.sin(angle);
    var comp2 = Math.cos(angle);

    for (var j = 0; j <= nstacks; j++) {
      var phi = (j * 2 * Math.PI) / nstacks;
      var comp3 = Math.sin(phi);
      var comp4 = Math.cos(phi);

      var xcood = comp4 * comp1;
      var ycoord = comp2;
      var zcoord = comp3 * comp1;
      var utex = 1 - j / nstacks;
      var vtex = 1 - i / nslices;
      
      spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
      spNormals.push(xcood, ycoord, zcoord);
      spTexCoords.push(utex, vtex);
    }
  }

  // now compute the indices here
  for (var i = 0; i < nslices; i++) {
    for (var j = 0; j < nstacks; j++) {
      var id1 = i * (nstacks + 1) + j;
      var id2 = id1 + nstacks + 1;

      spIndicies.push(id1, id2, id1 + 1);
      spIndicies.push(id2, id2 + 1, id1 + 1);
    }
  }
}

function initSphereBuffer() {
  var nslices = 180; // use even number
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
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(spIndicies), gl.STATIC_DRAW);
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
    
  spTexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spTexCoords), gl.STATIC_DRAW);
  spTexBuf.itemSize = 2;
  spTexBuf.numItems = spTexCoords.length / 2;
  
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
    aNormalLocation,
    spNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.vertexAttribPointer(
    aTextureLocation,
    spTexBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  gl.uniform3fv(uEyePositionLocation, eyePos);
  gl.uniform3fv(uColorLocation, color);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  gl.uniformMatrix4fv(uWNMatrixLocation, false, mat4.inverse(mat4.transpose(mMatrix)));
  
  gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

function setAttributes(){
  //get locations of attributes declared in the vertex shader
  aPositionLocation     = gl.getAttribLocation(shaderProgram, "aPosition");
  aTextureLocation      = gl.getAttribLocation(shaderProgram, "aTexture");
  aNormalLocation       = gl.getAttribLocation(shaderProgram, "aNormal");
  uMMatrixLocation      = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uPMatrixLocation      = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uVMatrixLocation      = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uWNMatrixLocation     = gl.getUniformLocation(shaderProgram, "uWNMatrix");
  uEyePositionLocation  = gl.getUniformLocation(shaderProgram, "uEyePos");
  uTextureLocation      = gl.getUniformLocation(shaderProgram, "cubeMap");
  u2DTextureLocation    = gl.getUniformLocation(shaderProgram, "cubeMap2D");
  uColorLocation        = gl.getUniformLocation(shaderProgram, "uDiffuseColor");
  uIsCubeMapLocation    = gl.getUniformLocation(shaderProgram, "uIsCubeMap");
  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
  gl.enableVertexAttribArray(aTextureLocation);
}

function processObject(objData) {
  objVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexPositions),
    gl.STATIC_DRAW
  );
  objVertexPositionBuffer.itemSize = 3;
  objVertexPositionBuffer.numItems = objData.vertexPositions.length/3;

  objVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(objData.indices),
    gl.STATIC_DRAW
  );
  objVertexIndexBuffer.itemSize = 1;
  objVertexIndexBuffer.numItems = objData.indices.length;
  
  objVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexNormals),
    gl.STATIC_DRAW
  );
  objVertexNormalBuffer.itemSize = 3;
  objVertexNormalBuffer.numItems = objData.vertexNormals.length/3;
  
  objVertexTextureBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexTextureCoords),
    gl.STATIC_DRAW
  );
  objVertexTextureBuffer.itemSize = 2;
  objVertexTextureBuffer.numItems = objData.vertexTextureCoords.length/2;

  drawScene();
}

function drawObject() {
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    objVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.vertexAttribPointer(
    aNormalLocation,
    objVertexNormalBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
  gl.vertexAttribPointer(
    aTextureLocation,
    objVertexTextureBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

  gl.uniform3fv(uEyePositionLocation, eyePos);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  gl.uniform1i(uIsCubeMapLocation, 1);
  gl.uniformMatrix4fv(uWNMatrixLocation, false, mat4.inverse(mat4.transpose(mMatrix)));

  gl.drawElements(
    gl.TRIANGLES,
    objVertexIndexBuffer.numItems,
    gl.UNSIGNED_INT,
    0
  );
}

function drawTeapot(){
  pushMatrix(mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, 0.665, 0.0]);
  mMatrix = mat4.scale(mMatrix, [0.072, 0.072, 0.072]);
  
  // for texture binding
  gl.activeTexture(gl.TEXTURE0);                // set texture unit 0 to use
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture); // bind the texture object to the texture unit
  gl.uniform1i(uTextureLocation, 0);            // pass the texture unit to the shader

  drawObject();
  mMatrix = popMatrix();
}

// function to draw each side of the skybox
function drawCubeFace(texture, textureEnum, textureNumber, location){
  
  pushMatrix(mMatrix);
  
  // texture setup for use
  gl.activeTexture(textureEnum); // set texture unit 1 to use
  gl.bindTexture(gl.TEXTURE_2D, texture); // bind the texture object 
  gl.uniform1i(u2DTextureLocation, textureNumber); // pass the texture unit
  // telling shader to treat it as textured surface

  // transformations
  mMatrix = mat4.translate(mMatrix, location);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [200, 200, 200]);

  drawCube(color);
  mMatrix = popMatrix(matrixStack);
}

function drawSkyBox(){

  // Back side of the cube
  drawCubeFace(negz, gl.TEXTURE1, 1, [0, 0, -195]);
  
  // Front side of the cube
  drawCubeFace(posz, gl.TEXTURE2, 2, [0, 0, 195]);

  // Left side of the cube
  drawCubeFace(negx, gl.TEXTURE3, 3, [-195, 0, 0]);
  
  // Right side of the cube
  drawCubeFace(posx, gl.TEXTURE4, 4, [195, 0, 0]);
  
  // Top side of the cube
  drawCubeFace(posy, gl.TEXTURE5, 5, [0, 195, 0]);
  
  // Bottom side of the cube
  drawCubeFace(negy, gl.TEXTURE6, 6, [0, -195, 0]);

}

function drawSpheres(){
  gl.uniform1i(uIsCubeMapLocation, 0);

  pushMatrix(mMatrix);
  var color = [70/255, 91/255, 41/255];
  mMatrix = mat4.rotate(mMatrix, degToRad(-10), [0,1,0]);
  mMatrix = mat4.translate(mMatrix, [0.0, 0.385, 1.8]);
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  drawSphere(color);
  mMatrix = popMatrix();

  pushMatrix(mMatrix);
  var color = [52/255, 39/255, 72/255];
  mMatrix = mat4.rotate(mMatrix, degToRad(45), [0,1,0]);
  mMatrix = mat4.translate(mMatrix, [0.0, 0.325, 1.2]);
  mMatrix = mat4.scale(mMatrix, [0.3, 0.3, 0.3]);
  drawSphere(color);
  mMatrix = popMatrix();
}

function drawRefractingCube(){
  pushMatrix(mMatrix);
  mMatrix = mat4.rotate(mMatrix, degToRad(-40), [0,1,0]);
  mMatrix = mat4.translate(mMatrix, [0.0, 0.45, 1.8]);
  mMatrix = mat4.scale(mMatrix, [0.4, 0.8, 0.4]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-35), [0,1,0]);

  // telling shader to treat it as refracting surface
  gl.uniform1i(uIsCubeMapLocation, 2);

  drawCube(color);
  mMatrix = popMatrix();
}

function drawRubixCube(){
  pushMatrix(mMatrix);
  mMatrix = mat4.rotate(mMatrix, degToRad(15), [0,1,0]);
  mMatrix = mat4.translate(mMatrix, [0.0, 0.307, 1.8]);
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-50), [0,1,0]);

  gl.activeTexture(gl.TEXTURE7);            // set texture unit 0 to use
  gl.bindTexture(gl.TEXTURE_2D, rubixCube); // bind the texture object to the texture unit
  gl.uniform1i(u2DTextureLocation, 7);
  // telling shader to treat it as textured surface
  gl.uniform1i(uIsCubeMapLocation, 3);

  drawCube(color);
  mMatrix = popMatrix();
}

function drawTable(){
  pushMatrix(mMatrix);

  mMatrix = mat4.translate(mMatrix, [0.0, 0.05, 0.0]);
  mMatrix = mat4.scale(mMatrix, [3.5, 0.1, 3.5]);

  gl.activeTexture(gl.TEXTURE8);                // set texture unit 0 to use
  gl.bindTexture(gl.TEXTURE_2D, wood); // bind the texture object to the texture unit
  gl.uniform1i(u2DTextureLocation, 8);            // pass the texture unit to the shader
  // telling shader to treat it as textured and reflecting surface
  gl.uniform1i(uIsCubeMapLocation, 4);

  drawSphere(color);

  mMatrix = popMatrix();
}

//The main drawing routine
function drawScene() {

  var degree = 0;

  var animate = function () {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const cosTheta = Math.cos(degToRad(degree));
    const sinTheta = Math.sin(degToRad(degree));

    eyeMatrix = [
      [cosTheta, 0, -sinTheta],
      [0, 1, 0],
      [sinTheta, 0, cosTheta]
    ]
    eyePos = myMatMul(initialEyePos, eyeMatrix);
    degree += speed;
    //set up the model matrix
    mat4.identity(mMatrix);

    // set up the view matrix, multiply into the modelview matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);

    //set up projection matrix
    mat4.identity(pMatrix);
    mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);

    mMatrix = mat4.rotate(mMatrix, degToRad(yAngle), [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(zAngle), [0, 1, 0]);

    // draw teapot
    drawTeapot();

    // draw skybox
    drawSkyBox();

    // draw Spheres
    drawSpheres();

    // drawRefractingCube
    drawRefractingCube();

    // draw Rubix Cube
    drawRubixCube();

    // draw Table
    drawTable();

    // window.requestAnimationFrame(animate);
  }
  animate();
}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);

  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
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
    var diffX = mouseX - prevMouseX;
    zAngle = zAngle + diffX / 5;
    prevMouseX = mouseX;

    var mouseY = canvas.height - event.clientY;
    var diffY = mouseY - prevMouseY;
    yAngle = yAngle - diffY / 5;
    prevMouseY = mouseY;

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

function handleTextureLoaded(texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,      // 2D texture
    0,                  // mipmap level
    gl.RGB,             // internal format
    gl.RGB,             // format
    gl.UNSIGNED_BYTE,   // type of data
    texture.image       // array or <img>
  );

  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

  drawScene();
}

function initTextures(file_path){
  var texture = gl.createTexture();
  texture.image = new Image();
  texture.image.src = file_path;
  texture.image.onload = function () {
    handleTextureLoaded(texture);
  };
  return texture;
}

function initCubeMap(){
  const faceInfos = [
    {target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, url: posx_file},
    {target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, url: negx_file},
    {target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, url: posy_file},
    {target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: negy_file},
    {target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, url: posz_file},
    {target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: negz_file},
  ];

  cubeMapTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);

  faceInfos.forEach((faceInfo) => {
    const {target, url} = faceInfo;
    gl.texImage2D(
      target,
      0,
      gl.RGBA,
      512,
      512,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    //load images again
    const image = new Image();
    image.src = url;
    image.addEventListener('load', function(){
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
      gl.texImage2D(
        target,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      drawScene();
    });
  });

  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

}

function initFiles(){
  posx_file = cubeMapPath.concat("posx.jpg");
  posy_file = cubeMapPath.concat("posy.jpg");
  posz_file = cubeMapPath.concat("posz.jpg");
  negx_file = cubeMapPath.concat("negx.jpg");
  negy_file = cubeMapPath.concat("negy.jpg");
  negz_file = cubeMapPath.concat("negz.jpg");

  posx = initTextures(posx_file);
  posy = initTextures(posy_file);
  posz = initTextures(posz_file);
  negz = initTextures(negz_file);
  negx = initTextures(negx_file);
  negy = initTextures(negy_file);

  rubixCube_file = "public/rcube.png";
  rubixCube = initTextures(rubixCube_file);

  wood_file = "public/wood_texture.jpg";
  wood = initTextures(wood_file);
}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("canvas");
  
  // if you want to move the scene, comment out the following line 
  // document.addEventListener("mousedown", onMouseDown, false);

  initGL(canvas);
  shaderProgram = initShaders(vertexShaderReflection, fragShaderEnvironment);

  gl.enable(gl.DEPTH_TEST);

  setAttributes();
  
  //initialize buffers for the square
  initObject();
  initFiles();
  initCubeBuffer();
  initSphereBuffer();
  initCubeMap();
  
}
