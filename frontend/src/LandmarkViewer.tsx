import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Landmark } from './landmarks'
import { buildInterior } from './interiors'

type Spec = {
  name: string
  colour: string
  note: string
}

function stone(colour: string, roughness = 0.72, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness, metalness })
}

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  return mesh
}

function cylinder(rt: number, rb: number, h: number, material: THREE.Material, x = 0, y = 0, z = 0, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material)
  mesh.position.set(x, y, z)
  return mesh
}

function dome(radius: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), material)
  mesh.scale.set(1, 1.18, 1)
  mesh.position.set(x, y, z)
  return mesh
}

function buildModel(landmark: Landmark): THREE.Group {
  const group = new THREE.Group()
  const marble = stone('#efe7d8', 0.5)
  const sandstone = stone('#b1583c', 0.85)
  const pink = stone('#d98b74', 0.8)
  const gold = stone('#d8a92e', 0.28, 0.9)
  const granite = stone('#7f868a', 0.9)
  const dark = stone('#241a12', 0.9)
  const water = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a6d8f'), roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.9,
  })
  const grass = stone('#1c4433', 0.95)

  switch (landmark.kind) {
    case 'taj': {
      const garden = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), grass)
      garden.rotation.x = -Math.PI / 2
      garden.position.y = -0.05
      group.add(garden)
      group.add(box(3, 0.06, 30, water, 0, 0.02, 13))
      group.add(box(21, 1.2, 21, marble, 0, 0.6, 0))
      group.add(box(9.4, 6, 9.4, marble, 0, 4.2, 0))
      group.add(box(3.6, 4.8, 0.8, dark, 0, 3.8, 4.8))
      group.add(box(1.7, 3.2, 0.8, dark, -3.1, 3.4, 4.8))
      group.add(box(1.7, 3.2, 0.8, dark, 3.1, 3.4, 4.8))
      group.add(cylinder(5.1, 5.1, 1.4, marble, 0, 7.9, 0, 40))
      group.add(dome(5, marble, 0, 10.3, 0))
      group.add(cylinder(0.12, 0.16, 2.2, gold, 0, 14.1, 0, 12))
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10).translate(0, 15.3, 0), gold))
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          group.add(cylinder(0.55, 0.72, 11.4, marble, sx * 7.7, 5.7, sz * 7.7, 16))
          group.add(cylinder(1.5, 1.5, 0.22, marble, sx * 7.7, 11.5, sz * 7.7, 20))
          group.add(dome(1.05, marble, sx * 7.7, 12.3, sz * 7.7))
        }
      }
      break
    }
    case 'gate': {
      const plinth = stone('#c9b79a', 0.9)
      group.add(box(16, 0.8, 6, plinth, 0, 0.4, 0))
      group.add(box(4, 9, 4, plinth, -5, 5, 0))
      group.add(box(4, 9, 4, plinth, 5, 5, 0))
      group.add(box(14, 3.4, 4, plinth, 0, 11.2, 0))
      group.add(box(14.6, 0.5, 4.6, plinth, 0, 13.1, 0))
      group.add(box(6.6, 7, 4.2, dark, 0, 3.9, 0))
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.1, 12),
        new THREE.MeshStandardMaterial({ color: '#ff9a3c', emissive: '#ff6a00', emissiveIntensity: 1.6 }),
      )
      flame.position.set(0, 1.4, 0)
      group.add(flame)
      break
    }
    case 'tower': {
      group.add(box(13, 4.4, 13, granite, 0, 2.2, 0))
      group.add(box(7.4, 3.4, 7.4, granite, 0, 5.6, 0))
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          group.add(cylinder(0.8, 1.0, 9.6, granite, sx * 5.1, 9.4, sz * 5.1, 16))
          group.add(cylinder(1.35, 1.35, 0.25, granite, sx * 5.1, 14.4, sz * 5.1, 18))
          group.add(dome(1.0, granite, sx * 5.1, 15.2, sz * 5.1))
        }
      }
      group.add(box(3, 3.4, 0.6, dark, 0, 2.2, 6.5))
      group.add(box(0.6, 3.4, 3, dark, 6.5, 2.2, 0))
      group.add(box(3, 3.4, 0.6, dark, 0, 2.2, -6.5))
      group.add(box(0.6, 3.4, 3, dark, -6.5, 2.2, 0))
      break
    }
    case 'palace': {
      for (let tier = 0; tier < 5; tier += 1) {
        const width = 17 - tier * 1.7
        const depth = 4 + tier * 0.5
        group.add(box(width, 2.3, depth, pink, 0, 1.15 + tier * 2.3, 0))
        const count = Math.max(3, Math.round(width / 2.4))
        for (let i = 0; i < count; i += 1) {
          const x = -width / 2 + (width / (count + 1)) * (i + 1)
          group.add(box(0.8, 1.05, 0.35, dark, x, 1.35 + tier * 2.3, depth / 2 + 0.05))
        }
      }
      group.add(cylinder(1.5, 1.7, 1.6, pink, 0, 12.2, 0, 16))
      group.add(dome(1.4, pink, 0, 13.4, 0))
      break
    }
    case 'minaret': {
      group.add(box(9, 1.2, 9, sandstone, 0, 0.6, 0))
      const storeys = [
        { rt: 1.9, rb: 2.4, h: 9, y: 5.7, m: sandstone },
        { rt: 1.5, rb: 1.9, h: 8, y: 14.2, m: sandstone },
        { rt: 1.1, rb: 1.5, h: 6.5, y: 21.5, m: marble },
        { rt: 0.8, rb: 1.1, h: 5, y: 27.3, m: marble },
        { rt: 0.55, rb: 0.8, h: 3.6, y: 31.6, m: marble },
      ]
      for (const s of storeys) {
        group.add(cylinder(s.rt, s.rb, s.h, s.m, 0, s.y, 0, 28))
        group.add(cylinder(s.rb + 0.35, s.rb + 0.35, 0.25, s.m, 0, s.y + s.h / 2, 0, 28))
      }
      group.add(dome(0.85, marble, 0, 34.3, 0))
      break
    }
    case 'temple': {
      const tank = new THREE.Mesh(new THREE.PlaneGeometry(52, 40), water)
      tank.rotation.x = -Math.PI / 2
      tank.position.y = 0.02
      group.add(tank)
      group.add(box(3.2, 0.2, 22, marble, 0, 0.12, 0))
      group.add(box(9, 3.4, 9, marble, 0, 1.7, -8))
      group.add(cylinder(4.4, 4.6, 1.2, gold, 0, 3.6, -8, 28))
      group.add(dome(4.1, gold, 0, 5.4, -8))
      group.add(cylinder(0.14, 0.18, 1.6, gold, 0, 9.6, -8, 12))
      for (const sx of [-1, 1]) {
        group.add(cylinder(1.5, 1.7, 1.0, gold, sx * 3.6, 3.4, -4.4, 18))
        group.add(dome(1.35, gold, sx * 3.6, 4.3, -4.4))
        group.add(cylinder(1.5, 1.7, 1.0, gold, sx * 3.6, 3.4, -11.6, 18))
        group.add(dome(1.35, gold, sx * 3.6, 4.3, -11.6))
      }
      group.add(box(6, 2.4, 4, marble, 0, 1.2, 4))
      break
    }
  }
  return group
}

export default function LandmarkViewer({ landmark }: { landmark: Landmark }) {
  const mount = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<{
    controls: OrbitControls
    camera: THREE.PerspectiveCamera
    reset: () => void
    scene: THREE.Scene
    model: THREE.Group
    renderer: THREE.WebGLRenderer
  } | null>(null)
  const [auto, setAuto] = useState(true)
  const [walking, setWalking] = useState(false)
  const [inside, setInside] = useState(false)

  useEffect(() => {
    const element = mount.current
    if (!element) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#08161b')
    scene.fog = new THREE.FogExp2('#08161b', 0.012)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400)
    camera.position.set(20, 14, 24)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    element.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x11261f, 1.15)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff1d5, 2.4)
    sun.position.set(18, 26, 12)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x74d6ff, 0.5)
    fill.position.set(-16, 8, -14)
    scene.add(fill)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: '#0a1f24', roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.12
    scene.add(ground)
    const grid = new THREE.GridHelper(120, 40, 0x1d4a4c, 0x123236)
    scene.add(grid)

    const model = buildModel(landmark)
    scene.add(model)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.target.set(0, 5, 0)
    controls.minDistance = 9
    controls.maxDistance = 70
    controls.maxPolarAngle = Math.PI / 2.02
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.7

    const reset = () => {
      camera.position.set(20, 14, 24)
      controls.target.set(0, 5, 0)
      controls.update()
    }

    const resize = () => {
      const width = element.clientWidth || 320
      const height = element.clientHeight || 240
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)

    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    sceneRef.current = { controls, camera, reset, scene, model, renderer }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const material = object.material
          if (Array.isArray(material)) material.forEach((item) => item.dispose())
          else material.dispose()
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentElement === element) element.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [landmark.id])

  useEffect(() => {
    const context = sceneRef.current
    if (!context) return
    context.controls.autoRotate = auto || walking
    context.controls.autoRotateSpeed = walking ? 2.2 : 0.75
    context.controls.maxPolarAngle = walking ? Math.PI / 2.14 : Math.PI / 1.98
    if (walking) {
      const direction = context.camera.position.clone().sub(context.controls.target)
      direction.y = 0
      direction.setLength(14)
      context.camera.position.set(
        context.controls.target.x + direction.x,
        6.5,
        context.controls.target.z + direction.z,
      )
      context.controls.update()
    }
  }, [auto, walking])

  // Explorable interior: first-person camera with WASD and drag-to-look.
  useEffect(() => {
    const context = sceneRef.current
    if (!context || !inside) return
    const { camera, controls, model, scene } = context

    controls.enabled = false
    model.visible = false
    const interior = buildInterior(landmark.kind)
    scene.add(interior)

    // Start inside the plan, a few metres back from the central feature.
    const state = { yaw: 0, pitch: 0, x: 0, z: 4.2 }
    camera.position.set(0, 1.7, 4.2)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(0, 0, 0)

    const pressed = new Set<string>()
    const keys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    const onKeyDown = (event: KeyboardEvent) => {
      if (isField(event.target)) return
      const key = event.key.toLowerCase()
      if (!keys.includes(key)) return
      pressed.add(key)
      event.preventDefault()
    }
    const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.key.toLowerCase())
    const onBlur = () => pressed.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    const element = context.renderer.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0
    const onPointerDown = (event: PointerEvent) => {
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      state.yaw -= (event.clientX - lastX) * 0.0045
      state.pitch = Math.max(-1.15, Math.min(1.15, state.pitch - (event.clientY - lastY) * 0.0045))
      lastX = event.clientX
      lastY = event.clientY
    }
    const onPointerUp = () => { dragging = false }
    element.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    let frame = 0
    let last = performance.now()
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      const seconds = Math.min(0.1, (time - last) / 1000)
      last = time
      const forward = (pressed.has('w') || pressed.has('arrowup') ? 1 : 0)
        - (pressed.has('s') || pressed.has('arrowdown') ? 1 : 0)
      const strafe = (pressed.has('d') || pressed.has('arrowright') ? 1 : 0)
        - (pressed.has('a') || pressed.has('arrowleft') ? 1 : 0)
      const speed = pressed.has('shift') ? 4.2 : 1.6
      const sin = Math.sin(state.yaw)
      const cos = Math.cos(state.yaw)
      state.x += (-sin * forward + cos * strafe) * speed * seconds
      state.z += (-cos * forward - sin * strafe) * speed * seconds
      const radius = Math.hypot(state.x, state.z)
      if (radius > 10) {
        state.x *= 10 / radius
        state.z *= 10 / radius
      }
      camera.position.set(state.x, 1.7, state.z)
      camera.rotation.set(state.pitch, state.yaw, 0)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      pressed.clear()
      scene.remove(interior)
      interior.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const material = object.material
          if (Array.isArray(material)) material.forEach((item) => item.dispose())
          else material.dispose()
        }
      })
      model.visible = true
      controls.enabled = true
      controls.target.set(0, 5, 0)
      camera.rotation.set(0, 0, 0)
      context.reset()
    }
  }, [inside, landmark.kind])

  const materialRows: Spec[] = landmark.materials

  return (
    <div className="viewer-wrap">
      <div className="viewer-canvas" ref={mount} />
      <div className="viewer-toolbar">
        <button className={auto ? 'active' : ''} onClick={() => setAuto(!auto)} title="Auto-rotate">AUTO</button>
        <button className={walking ? 'active' : ''} onClick={() => { setWalking(!walking); setInside(false) }} title="Walk the grounds">WALK</button>
        <button className={inside ? 'active' : ''} onClick={() => { setInside(!inside); setWalking(false); setAuto(false) }} title="Step inside the building">INSIDE</button>
        <button onClick={() => sceneRef.current?.reset()} title="Reset camera">RESET</button>
      </div>
      <div className="viewer-note">
        {inside
          ? 'INTERPRETIVE INTERIOR · BUILT FROM PUBLISHED DESCRIPTIONS, NOT PHOTOS · WASD TO WALK'
          : `PROCEDURAL 3D · ${landmark.kind.toUpperCase()} · DRAG TO ORBIT 360°`}
      </div>
      <div className="viewer-swatches">
        {materialRows.slice(0, 4).map((material) => (
          <span key={material.name} title={material.name}>
            <i style={{ background: material.colour }} /> {material.name.split(' ')[0]}
          </span>
        ))}
      </div>
    </div>
  )
}
