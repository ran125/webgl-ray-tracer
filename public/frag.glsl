#version 300 es

precision highp float;
precision highp int;

// ----------------------------------------------------------------------------
// structures
//
struct Ray {
    vec3 origin;
    vec3 dir;
};

struct Sphere {
    vec3  center;
    float radius;
    float radiusSquared;
    int   materialIndex;
};

struct Material {
    int   materialClass;
    vec3  albedo;
    float shininess;
    float refractionIndex;
};

struct RayHitResult {
    float t;
    vec3  n;
    vec3  p;
    int   materialIndex;
};

// ----------------------------------------------------------------------------
// constants
//
const float MAX_FLT = intBitsToFloat(2139095039);
const float EPSILON = 0.01;

const int METALLIC_MATERIAL   = 0;
const int LAMBERTIAN_MATERIAL = 1;
const int DIELECTRIC_MATERIAL = 2;

const int MAX_MATERIALS = 32;
const int MAX_SPHERES   = 32;

// ----------------------------------------------------------------------------
// uniforms
//
uniform Material u_materials[MAX_MATERIALS];
uniform Sphere   u_spheres[MAX_SPHERES];

uniform highp usampler2D u_rndSampler;

uniform int u_num_spheres;
uniform int u_num_samples;
uniform int u_num_bounces;

uniform float u_eye_to_y;

// ----------------------------------------------------------------------------
// varyings
//
in float v_eye_to_x;
in float v_eye_to_z;

in vec2  v_tuv;

// ----------------------------------------------------------------------------
// outputs
//
out vec4 o_color;

// ----------------------------------------------------------------------------
// randomness
//
uvec4 g_generatorState;

uint tauswortheGenerator(uint z, int S1, int S2, int S3, uint M) {
    return ((z & M) << S3) ^ (((z << S1) ^ z) >> S2);
}

uint linearCongruentialGenerator(uint z, uint A, uint C) {
  return A * z + C;
}

float rand() {
    g_generatorState.x = tauswortheGenerator(g_generatorState.x, 13, 19, 12, 4294967294u); // p1=2^31-1
    g_generatorState.y = tauswortheGenerator(g_generatorState.y, 2,  25, 4,  4294967288u); // p2=2^30-1
    g_generatorState.z = tauswortheGenerator(g_generatorState.z, 3,  11, 17, 4294967280u); // p3=2^28-1
    g_generatorState.w = linearCongruentialGenerator(g_generatorState.w, 1664525u, 1013904223u);  // p4=2^32

    // Combined period is lcm(p1,p2,p3,p4) ~ 2^121
    return 2.3283064365387e-10 * float(g_generatorState.x ^ g_generatorState.y ^ g_generatorState.z ^ g_generatorState.w);
}

vec3 randPosInUnitSphere() {
    vec3 p;
    do 
    { p = 2.0 * vec3(rand(), rand(), rand()) + vec3(-1.0, -1.0, -1.0);
    } while (dot(p, p) > 1.0);

    return p;
}

// ----------------------------------------------------------------------------
// ray sphere intersections
//
bool rayIntersectSphere(Ray r, Sphere s, out RayHitResult res) {
    vec3  l = r.origin - s.center;
    float a = dot(r.dir, r.dir);
    float b = dot(r.dir, l);
    float c = dot(l, l) - s.radiusSquared;

    float discriminant = (b * b) - (a * c);
    if (discriminant > 0.0) {
        float sq = sqrt(discriminant);
        float t;

        t = (-b - sq) / a;
        if (t >= 0.0) {
            res.t = t;
            res.p = r.origin + r.dir * t;
            res.n = (res.p - s.center) / s.radius;
            res.materialIndex = s.materialIndex;
            return true;
        }
        t = (-b + sq) / a;
        if (t >= 0.0) {
            res.t = t;
            res.p = r.origin + r.dir * t;
            res.n = (res.p - s.center) / s.radius;
            res.materialIndex = s.materialIndex;
            return true;
        }
    }
    return false;
}

bool rayIntersectNearestSphere(Ray ray, out RayHitResult nearest) {
    RayHitResult current;
    bool contact = false;

    for (int i = 0; i < u_num_spheres; ++i) {
        if (rayIntersectSphere(ray, u_spheres[i], current)) {
            if (!contact || current.t < nearest.t) {
                nearest = current;
                contact = true;
            }
        }
    }
    return contact;
}

// ----------------------------------------------------------------------------
// ray cast from eye through pixel
//
float schlick(float cosine, float rindex) {
    float r0 = (1.0 - rindex) / (1.0 + rindex);
    r0 *= r0;
    
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

void rayHitMetallicSurface(RayHitResult res, inout Ray ray, inout vec3 color) {
    Material metallic = u_materials[res.materialIndex];

    ray.origin = res.p + res.n * EPSILON;
    ray.dir    = normalize(reflect(ray.dir, res.n) + (1.0 - metallic.shininess) * randPosInUnitSphere());

    if (dot(ray.dir, res.n) > 0.0) {
        color *= metallic.albedo;
    } else {
        color = vec3(0.0, 0.0, 0.0);
    }
}

void rayHitLambertianSurface(RayHitResult res, inout Ray ray, inout vec3 color) {
    Material lambertian = u_materials[res.materialIndex];

    ray.origin = res.p + res.n * EPSILON;
    ray.dir    = normalize(ray.origin + res.n + randPosInUnitSphere() - res.p);

    color *= lambertian.albedo;
}

void rayHitDielectricSurface(RayHitResult res, inout Ray ray, inout vec3 color) {
    Material dielectric = u_materials[res.materialIndex];
    float rindex;
    vec3  refraction;
    vec3  normal;

    if (dot(ray.dir, res.n) > 0.0) { // from sphere into air
        rindex = dielectric.refractionIndex;
        normal = -res.n;
    } else { // into sphere from air
        rindex = 1.0 / dielectric.refractionIndex;
        normal = +res.n;
    }

    refraction = refract(ray.dir, normal, rindex);
    if (dot(refraction, refraction) > 0.0) {
        ray.origin = res.p - normal * EPSILON;
        ray.dir    = refraction;
    } else {
        ray.origin = res.p + res.n * EPSILON;
        ray.dir    = reflect(ray.dir, res.n);
    }

    color *= dielectric.albedo;
}

vec3 castPrimaryRay(Ray ray) {
    vec3 color = vec3(1.0, 1.0, 1.0);
    RayHitResult res;

    for (int i = 0; i < u_num_bounces + 1; ++i) {
        if (rayIntersectNearestSphere(ray, res)) {
            switch (u_materials[res.materialIndex].materialClass) {
            case METALLIC_MATERIAL:
                rayHitMetallicSurface(res, ray, color);
                break;
            case LAMBERTIAN_MATERIAL:
                rayHitLambertianSurface(res, ray, color);
                break;
            case DIELECTRIC_MATERIAL:
                rayHitDielectricSurface(res, ray, color);
                break;
            }
        } else {
            float t = (1.0 + normalize(ray.dir).z) * 0.5;
            color *=  (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
            break; // out of for loop
        }
    }

    return color;
}

// ----------------------------------------------------------------------------
// main
//
void main() {
    g_generatorState = texture(u_rndSampler, v_tuv);

    Ray r;
    r.origin = vec3(0.0, 0.0, 0.0);
    vec3 sum = vec3(0.0, 0.0, 0.0);

    for (int i = 0; i < u_num_samples; ++i) {
        r.dir = vec3(
            v_eye_to_x + rand(), 
            u_eye_to_y, 
            v_eye_to_z + rand()
        );
        r.dir = normalize(r.dir);
        sum += castPrimaryRay(r);
    }

    o_color = vec4(sum / float(u_num_samples), 1.0);
}
