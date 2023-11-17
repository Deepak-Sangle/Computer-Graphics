var gl;
var canvas;

var aPositionLocation;

var uLightPositionLocation;
var uBounceLimitLocation;
var uColorLocation;
var uShadingModeLocation;

var buf;

var lightPosition = [-1.0, 10.0, 3.0];
var bounceLimit = 1;
var shadingMode = 0;

const vertexShaderCode = `#version 300 es
in vec3 aPosition;

void main() {
  gl_Position =  vec4(aPosition, 1.0);
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform vec3 uLightPosition;
uniform vec3 uColor;
uniform int uBounceLimit;
uniform int uShadingMode;

out vec4 fragColor;

struct Sphere {
  vec3 center;
  float radius;
  vec3 color;
  float specular;
};

struct Ray {
  vec3 origin;
  vec3 direction;
};
  
struct Light {
  vec3 position;
  vec3 specular;
  vec3 shadow;
};

float intersectSphere(Sphere sphere, Ray ray) {
  
  float a = dot(ray.direction, ray.direction);
  float b = 2.0 * dot(ray.direction, (ray.origin - sphere.center));
  float c = dot(ray.origin - sphere.center, ray.origin - sphere.center) - sphere.radius * sphere.radius;
  float delta = b * b - 4.0 * a * c;
  float t = 0.0;

  if(delta >= 0.0) {
    float t1 = (-b + sqrt(delta)) / (2.0 * a);
    float t2 = (-b - sqrt(delta)) / (2.0 * a);
    t = min(t1, t2);
  }

  return t;
}

vec4 computePhongColor(vec3 hitPoint, Sphere sphere, Light light, Ray ray) {
  
  vec3 normal = normalize(hitPoint - sphere.center);

  vec3 lightVector = normalize(light.position - hitPoint);
  vec3 reflectVector = normalize(-reflect(lightVector, normal));
  vec3 viewVector = normalize(ray.origin - hitPoint);
  
  float costheta = max(dot(lightVector, normal), 0.0);
  float cosalpha = pow(max(dot(reflectVector, viewVector), 0.0), sphere.specular);

  vec4 phong_color = vec4(sphere.color*0.21 + light.specular*cosalpha + sphere.color*costheta*0.5, 1.0);

  return phong_color;
}

int findNearestSphere(Sphere spheres[4], Ray ray){
  int hitting_sphere = -1;
  float min_t = 100000.0;

  for(int i=0; i<4; i++){
    float t = intersectSphere(spheres[i], ray);
    if(t == 0.0){
      continue;
    }
    if(t < min_t && t>0.0){
      min_t = t;
      hitting_sphere = i;
    }
  }

  return hitting_sphere;
}

bool isInShadow(Sphere spheres[4], Ray shadow_ray){
  for(int i=0; i<3; i++){
    float t = intersectSphere(spheres[i], shadow_ray);
    if(t != 0.0){
      return true;
    }
  }
  return false;
}

void main() {
  
  Ray ray;
  ray.origin = vec3(0.0, 0.0, 1.0);
  vec2 screenPos = gl_FragCoord.xy/vec2(600, 600);
  ray.direction = normalize(vec3(screenPos * 2.0 - 1.0, -1.0));

  Light light;
  light.position = uLightPosition;
  light.specular = vec3(1.0, 1.0, 1.0);
  light.shadow = vec3(1.0,1.0,1.0)*0.1;

  Sphere spheres[4];
  spheres[0] = Sphere(vec3(-0.3, 0.1, 0.5),  0.2, vec3(0.0, 1.0, 0.0), 29.0);
  spheres[1] = Sphere(vec3(0.0,  0.28,-0.2), 0.49, vec3(1.0, 0.0, 0.0), 15.0);
  spheres[2] = Sphere(vec3(0.3,  0.1, 0.5),  0.2, vec3(0.0, 0.0, 1.0), 100.0);
  spheres[3] = Sphere(vec3(0.0, -2.5, 0.0),  2.3, vec3(0.4, 0.4, 0.4), 10000000.0);

  int hitting_sphere = findNearestSphere(spheres, ray);
  
  if(hitting_sphere == -1){
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float t = intersectSphere(spheres[hitting_sphere], ray);
  
  vec3 hitPoint = ray.origin + ray.direction * t;
  vec4 phong_color = computePhongColor(hitPoint, spheres[hitting_sphere], light, ray);
  
  int bounced_sphere = hitting_sphere;
  vec3 bounced_point = hitPoint;
  Ray reflection_ray = Ray(ray.origin, ray.direction);

  for(int i=0;i<uBounceLimit && (uShadingMode == 2 || uShadingMode == 3);i++){
    vec3 reflection_direction = normalize(reflect(reflection_ray.direction, normalize(bounced_point - spheres[bounced_sphere].center)));
    reflection_ray.origin = bounced_point + 0.01*reflection_direction;
    reflection_ray.direction = reflection_direction;

    int reflection_sphere = findNearestSphere(spheres, reflection_ray);
    float hitT = intersectSphere(spheres[reflection_sphere], reflection_ray);
    
    if(hitT<=0.0){
      break;
    }

    bounced_sphere = reflection_sphere;
    bounced_point = reflection_ray.origin + reflection_ray.direction * hitT;
    
    phong_color += 0.5*computePhongColor(bounced_point, spheres[reflection_sphere], light, reflection_ray);

  }

  if(hitting_sphere != 3){
    fragColor = phong_color;
    return ;
  }

  Ray shadow_ray;
  shadow_ray.origin = hitPoint;
  shadow_ray.direction = normalize(light.position - hitPoint);

  if((uShadingMode == 1 || uShadingMode == 3) && isInShadow(spheres, shadow_ray)){
    fragColor = vec4(light.shadow, 1.0) ;
  }
  else{
    fragColor = phong_color;
  }

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
    gl = canvas.getContext("webgl2");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function initQuadBuffer() {
  var vertices = [
    -1,  1, 0,
     1,  1, 0,
    -1, -1, 0,
    -1, -1, 0,
     1,  1, 0,
     1, -1, 0,
  ];
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  buf.itemSize = 3;
  buf.numItems = vertices.length / 3;
}

function drawQuad(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(
    aPositionLocation,
    buf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.uniform3fv(uLightPositionLocation, lightPosition);
  gl.uniform3fv(uColorLocation, color);
  gl.uniform1i(uBounceLimitLocation, bounceLimit);
  gl.uniform1i(uShadingModeLocation, shadingMode);
  
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function setAttributes(){
  aPositionLocation       = gl.getAttribLocation(shaderProgram, "aPosition");
  uLightPositionLocation  = gl.getUniformLocation(shaderProgram, "uLightPosition");
  uColorLocation          = gl.getUniformLocation(shaderProgram, "uColor");
  uBounceLimitLocation    = gl.getUniformLocation(shaderProgram, "uBounceLimit");
  uShadingModeLocation    = gl.getUniformLocation(shaderProgram, "uShadingMode");
  gl.enableVertexAttribArray(aPositionLocation);
}

//The main drawing routine
function drawScene() {

  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  var red_color = [1.0, 0.0, 0.0];

  drawQuad(red_color);

}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("canvas");
  
  initGL(canvas);
  shaderProgram = initShaders(vertexShaderCode, fragShaderCode);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  var error = gl.getError();
  if (error !== gl.NO_ERROR) {
      console.error("WebGL error: " + error);
  }
  
  setAttributes();
  
  //initialize buffers for the square
  initQuadBuffer();

  drawScene();
}

function showPhong(){
  document.getElementById('image-mode').innerHTML = 'Phong';
  shadingMode = 0;
  drawScene();
}

function showPhongShadow(){
  document.getElementById('image-mode').innerHTML = 'Phong and Shadow';
  shadingMode = 1;
  drawScene();
}

function showPhongReflection(){
  document.getElementById('image-mode').innerHTML = 'Phong and Reflection';
  shadingMode = 2;
  drawScene();
}

function showPhongShadowReflection(){
  document.getElementById('image-mode').innerHTML = 'Phong, Shadow and Reflection';
  shadingMode = 3;
  drawScene();
}

function moveLight(value){
  lightPosition[0] = value/10.0;
  drawScene();
}

function changeBounceLimit(value){
  bounceLimit = value;
  drawScene();
}