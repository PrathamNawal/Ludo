// Entry for the vendored three.js bundle: only what Ludo Adda uses, so tree-shaking keeps it small.
// Rebuild with: npm run vendor
export {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D, Color, Vector2, Vector3, Quaternion, Euler,
  MathUtils, BoxGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, ExtrudeGeometry, Shape, ShapeGeometry, RingGeometry,
  TorusGeometry, CircleGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace,
  NeutralToneMapping, PCFShadowMap, ShadowMaterial, HemisphereLight, DirectionalLight, PointLight, AdditiveBlending, DoubleSide,
  PMREMGenerator, RepeatWrapping,
} from 'three';
export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
