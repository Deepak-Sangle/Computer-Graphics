var gl;
var canvas;
var reader;

var aPositionLocation;
var aTextureLocation;
var uMMatrixLocation;
var u2DTextureLocation1;
var u2DTextureLocation2;
var uTextureTypeLocation;

var uContrastLocation;
var uBrightnessLocation;
var uBackgroundModeLocation;
var uAlphaBlendedLocation;

var buf;
var indexBuf;

var cubeMapTexture;
var cubeTextureBuf;

var mMatrix = mat4.create(); // model matrix

var textureType = -1;

var sepia, grayscale, brightness, contrast;

var background_file, background_texture;
var foreground_file, foreground_texture;

var background_file_path, foreground_file_path;

const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec2 aTexture;

uniform mat4 uMMatrix;

out vec2 t;

void main() {

  // pass texture coordinate to frag shader with y coordinate flipped
  t = vec2(aTexture.s, 1.0 - aTexture.t);

  // calcuie clip space position
  gl_Position =  uMMatrix*vec4(aPosition,1.0);

}`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform sampler2D texture1;
uniform sampler2D texture2;
uniform int uTextureType;
uniform int uBackgroundMode;
uniform int uIsAlphaBlended;

uniform float uContrast;
uniform float uBrightness;

in vec2 t;

out vec4 fragColor;

vec3 to_grayscale = vec3(0.2126, 0.7152, 0.0722);
vec3 to_contrast = vec3(0.5, 0.5, 0.5);

vec4 kernel[9];

void make_kernel(sampler2D tex){
  ivec2 texel_size = textureSize(tex, 0);
  float w = 3.0 / float(texel_size.x);
  float h = 3.0 / float(texel_size.y);
  kernel[0] += texture(tex, t + vec2(-w, -h));
	kernel[1] += texture(tex, t + vec2(0.0, -h));
	kernel[2] += texture(tex, t + vec2(w, -h));
	kernel[3] += texture(tex, t + vec2(-w, 0.0));
	kernel[4] += texture(tex, t);
	kernel[5] += texture(tex, t + vec2(w, 0.0));
	kernel[6] += texture(tex, t + vec2(-w, h));
	kernel[7] += texture(tex, t + vec2(0.0, h));
	kernel[8] += texture(tex, t + vec2(w, h));
}

void main() {
  make_kernel(texture1);
  
  vec4 textureColor = texture(texture1, t); 
  
  if(uIsAlphaBlended == 1){
    vec4 foregroundTextureColor = texture(texture2, t);
    textureColor = mix(textureColor, foregroundTextureColor, foregroundTextureColor.a);
  }

  if(uBackgroundMode == 1){
    vec4 final_color = vec4(0.0, 0.0, 0.0, 1.0);
    for(int i=0;i<9;i++){
      final_color += kernel[i];
    }
    textureColor = final_color/9.0;
  }
  else if(uBackgroundMode == 2){
    vec4 final_color = vec4(0.0, 0.0, 0.0, 1.0);
    final_color += kernel[1] * -1.0;
    final_color += kernel[3] * -1.0;
    final_color += kernel[4] *  5.0;
    final_color += kernel[5] * -1.0;
    final_color += kernel[7] * -1.0;
    textureColor = final_color;
  }
  else if(uBackgroundMode == 3){
    vec4 final_color = vec4(0.0, 0.0, 0.0, 1.0);
    vec4 dy = kernel[3] * -1.0 + kernel[5] * 1.0;
    vec4 dx = kernel[1] * -1.0 + kernel[7] * 1.0;
    final_color = sqrt(dy*dy + dx*dx);
    textureColor = final_color;
  }
  else if(uBackgroundMode == 4){
    vec4 final_color = vec4(0.0, 0.0, 0.0, 1.0);
    final_color += kernel[1] * -1.0;
    final_color += kernel[3] * -1.0;
    final_color += kernel[4] *  4.0;
    final_color += kernel[5] * -1.0;
    final_color += kernel[7] * -1.0;
    textureColor = final_color;
  }

  if(uTextureType == 1){
    float grayscale = dot(textureColor.rgb, to_grayscale);
    textureColor = vec4(grayscale, grayscale, grayscale, textureColor.a);
  }
  else if(uTextureType == 2){
    float sepiaR = 0.393*textureColor.r + 0.769*textureColor.g + 0.189*textureColor.b;
    float sepiaG = 0.349*textureColor.r + 0.686*textureColor.g + 0.168*textureColor.b;
    float sepiaB = 0.272*textureColor.r + 0.534*textureColor.g + 0.131*textureColor.b;
    textureColor = vec4(sepiaR, sepiaG, sepiaB, 1.0);
  }
  textureColor = vec4(to_contrast + (uContrast + 1.0) * (textureColor.rgb - to_contrast), 1.0);
  
  vec3 to_brightness = vec3(uBrightness, uBrightness, uBrightness);
  textureColor = vec4(textureColor.rgb + to_brightness, textureColor.a);

  fragColor = textureColor;
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
    gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
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

function drawCube() {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(
    aPositionLocation,
    buf.itemSize,
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
  
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function setupTexture(){
  gl.uniform1i(uTextureTypeLocation, textureType);
  drawScene();
}

function setAttributes(){
  //get locations of attributes declared in the vertex shader
  aPositionLocation     = gl.getAttribLocation(shaderProgram, "aPosition");
  aTextureLocation      = gl.getAttribLocation(shaderProgram, "aTexture");
  uMMatrixLocation      = gl.getUniformLocation(shaderProgram, "uMMatrix");
  u2DTextureLocation1    = gl.getUniformLocation(shaderProgram, "texture1");
  u2DTextureLocation2    = gl.getUniformLocation(shaderProgram, "texture2");
  uTextureTypeLocation  = gl.getUniformLocation(shaderProgram, "uTextureType");
  uContrastLocation     = gl.getUniformLocation(shaderProgram, "uContrast");
  uBrightnessLocation   = gl.getUniformLocation(shaderProgram, "uBrightness");
  uBackgroundModeLocation   = gl.getUniformLocation(shaderProgram, "uBackgroundMode");
  uAlphaBlendedLocation   = gl.getUniformLocation(shaderProgram, "uIsAlphaBlended");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aTextureLocation);
}

//The main drawing routine
function drawScene() {

  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  //set up the model matrix
  mat4.identity(mMatrix);

  mMatrix = mat4.scale(mMatrix, [2.0,2.0,2.0]);
  drawCube();

}

function handleTextureLoaded(texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,      // 2D texture
    0,                  // mipmap level
    gl.RGBA,             // internal format
    gl.RGBA,             // format
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
  texture.image.crossOrigin = "anonymous";
  texture.image.src = file_path;
  texture.image.onload = function () {
    handleTextureLoaded(texture);
  };
  return texture;
}

// This is the entry point from the html
function webGLStart() {
  
  console.log("token: ", process.env.PERSONAL_ACCESS_TOKEN);
  canvas = document.getElementById("canvas");
  
  initGL(canvas);
  shaderProgram = initShaders(vertexShaderCode, fragShaderCode);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  var error = gl.getError();
  if (error !== gl.NO_ERROR) {
      console.error("WebGL error: " + error);
  }
  
  setAttributes();
  
  //initialize buffers for the square
  initCubeBuffer();

  //some other references
  sepia       = document.getElementById('sepia-checkbox');
  grayscale   = document.getElementById('grayscale-checkbox');
  brightness  = document.getElementById('brightness-slider');
  contrast    = document.getElementById('contrast-slider');

  drawScene();
}

function changeDropdownValue(text, id){
  document.getElementById(id).innerHTML = text;
}

function readAsDataURLAsync(file) {
  return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function (event) {
          resolve(event.target.result);
      };

      reader.onerror = function (event) {
          reject(event.target.error);
      };

      reader.readAsDataURL(file);
  });
}

async function uploadImage(fileInput, is_background){
  const file = fileInput.files[0];

  if (!file) {
      alert('Please select a file');
      return;
  }

  try {
    const dataURL = await readAsDataURLAsync(file);
    const accessToken = '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';
    const repoOwner = 'Deepak-Sangle';
    const repoName = 'Computer-Graphics';
    const branchName = 'main';
    const randomFileName = Math.random().toString(36).substring(2, 15); 
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${randomFileName + file.name}`;

    const requestBody = {
        message: 'Upload image',
        content: dataURL.split(',')[1], // Extracting base64 data
        branch: branchName
    };

    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            Authorization: `token ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();
    
    if(is_background === true)
      background_file_path = responseData.content.download_url;
    else
      foreground_file_path = responseData.content.download_url;

  } catch (error) {
      console.error('Error uploading image:', error);
  }

}

async function loadBackgroundFile(input){
  background_file = input.files[0].name;
  changeDropdownValue(background_file, 'file-name-1');
  
  await uploadImage(input, true);
  console.log({background_file_path});
  background_texture = initTextures(background_file_path);
  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, background_texture);
  gl.uniform1i(u2DTextureLocation1, 0);
  
  showBackgroundOnlyView();
}

async function loadForegroundFile(input){
  foreground_file = input.files[0].name;
  changeDropdownValue(foreground_file, 'file-name-2');
  
  await uploadImage(input, false);
  console.log({foreground_file_path});
  foreground_texture = initTextures(foreground_file_path);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, foreground_texture);
  gl.uniform1i(u2DTextureLocation2, 1);

}

function showBackgroundOnlyView(){
  document.getElementById('image-mode').innerHTML = 'Background Only';
  gl.uniform1i(uAlphaBlendedLocation, 0);
  setupTexture();
}

function showAlphaBlendedView(){
  document.getElementById('image-mode').innerHTML = 'Alpha Blended';
  gl.uniform1i(uAlphaBlendedLocation, 1);
  setupTexture();
}

function changeGrayscaleMode(obj){
  if(sepia.checked){
    sepia.checked = false;
  }
  if(obj.checked){
    textureType = 1;
    setupTexture();
  }
  else{
    textureType = 0;
    setupTexture();
  }
  
}

function changeSepiaMode(obj){
  if(grayscale.checked){
    grayscale.checked = false;
  }
  if(obj.checked){
    textureType = 2;
    setupTexture();
  }
  else{
    textureType = 0;
    setupTexture();
  }
}

function changeContrast(value){
  gl.uniform1f(uContrastLocation, value/100);
  setupTexture();
}

function changeBrightness(value){
  gl.uniform1f(uBrightnessLocation, value/100);
  setupTexture();
}

function Smooth() {
  changeDropdownValue('Smooth', 'background-mode');
  gl.uniform1i(uBackgroundModeLocation, 1);
  setupTexture();
}

function Sharpen() {
  changeDropdownValue('Sharpen', 'background-mode');
  gl.uniform1i(uBackgroundModeLocation, 2);
  setupTexture();
}

function Gradient() {
  changeDropdownValue('Gradient', 'background-mode');
  gl.uniform1i(uBackgroundModeLocation, 3);
  setupTexture();
}

function Laplacian() {
  changeDropdownValue('Laplacian', 'background-mode');
  gl.uniform1i(uBackgroundModeLocation, 4);
  setupTexture();
}

function None() {
  changeDropdownValue('Background Image', 'background-mode');
  gl.uniform1i(uBackgroundModeLocation, 0);
  setupTexture();
}

function ResetScreen(){
  textureType = 0;
  grayscale.checked = false;
  sepia.checked = false;
  brightness.value = 0;
  contrast.value = 0;
  gl.uniform1f(uBrightnessLocation, 0.0);
  gl.uniform1f(uContrastLocation, 0.0);
  showBackgroundOnlyView();
  None();
}

function saveScreenshot(){
  var dataURL = canvas.toDataURL("image/png");
  var link = document.createElement("a");
  link.href = dataURL;
  link.download =  background_file + "_edited.png";
  link.click();
}