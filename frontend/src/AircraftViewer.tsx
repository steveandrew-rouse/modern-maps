import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Signal } from './types'
import { liveryFor } from './airlines'

/**
 * Procedural narrowbody airliner painted in the operator's livery. OpenSky's
 * state vectors carry no airframe type, so this is a representative single-aisle
 * jet rather than a specific registration.
 */
function buildAircraft(body: string, accent: string, trim: string): THREE.Group {
  const group = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(body), roughness: 0.34, metalness: 0.55 })
  const paint = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.42, metalness: 0.35 })
  const stripe = new THREE.MeshStandardMaterial({ color: new THREE.Color(trim), roughness: 0.5, metalness: 0.3 })
  const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa6b2'), roughness: 0.32, metalness: 0.85 })
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1b2530'), roughness: 0.55, metalness: 0.4 })
  const glass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0d1b28'), roughness: 0.1, metalness: 0.9 })

  // Fuselage
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 22, 32, 1, false), skin)
  barrel.rotation.z = Math.PI / 2
  group.add(barrel)

  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.55, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), skin)
  nose.rotation.z = -Math.PI / 2
  nose.position.x = 11
  nose.scale.set(1, 1.42, 1)
  group.add(nose)

  const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 20), dark)
  noseTip.rotation.z = -Math.PI / 2
  noseTip.position.x = 13.1
  group.add(noseTip)

  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(1.55, 5.4, 32), skin)
  tailCone.rotation.z = Math.PI / 2
  tailCone.position.x = -13.1
  group.add(tailCone)

  // Cockpit and cabin glazing
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 12), glass)
  cockpit.position.set(10.1, 0.72, 0)
  cockpit.scale.set(0.85, 0.55, 0.95)
  group.add(cockpit)

  for (const side of [1, -1]) {
    const windows = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.22, 0.06), glass)
    windows.position.set(-1.2, 0.52, side * 1.5)
    group.add(windows)
  }

  // Cheatline along the fuselage
  const cheat = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 0.08), stripe)
  cheat.position.set(-1, 0.1, 0)
  cheat.scale.z = 1
  group.add(cheat)
  for (const side of [1, -1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(20, 0.34, 0.07), stripe)
    line.position.set(-1, 0.12, side * 1.51)
    group.add(line)
  }

  // Wings with sweep and winglets
  const wingShape = new THREE.Shape()
  wingShape.moveTo(0, 0)
  wingShape.lineTo(-5.4, 15.6)
  wingShape.lineTo(-7.6, 15.6)
  wingShape.lineTo(-2.6, 0)
  wingShape.closePath()
  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.36, bevelEnabled: false })
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(wingGeometry, skin)
    wing.rotation.x = -Math.PI / 2
    wing.rotation.z = 0
    wing.position.set(1.6, -0.55, 0)
    wing.scale.z = side
    group.add(wing)
  }

  const wingletGeometry = new THREE.BoxGeometry(0.3, 1.9, 1.5)
  for (const side of [1, -1]) {
    const winglet = new THREE.Mesh(wingletGeometry, paint)
    winglet.position.set(-3.6, 0.35, side * 15.2)
    group.add(winglet)
  }

  // Engines
  for (const side of [1, -1]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.95, 3.6, 24), metal)
    nacelle.rotation.z = Math.PI / 2
    nacelle.position.set(0.4, -1.35, side * 6.2)
    group.add(nacelle)
    const cowl = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.16, 12, 28), paint)
    cowl.rotation.y = Math.PI / 2
    cowl.position.set(2.2, -1.35, side * 6.2)
    group.add(cowl)
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.86, 28), dark)
    fan.rotation.y = Math.PI / 2
    fan.position.set(2.24, -1.35, side * 6.2)
    group.add(fan)
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.5), metal)
    pylon.position.set(-0.4, -0.9, side * 6.2)
    group.add(pylon)
  }

  // Vertical stabiliser in the operator's accent colour
  const finShape = new THREE.Shape()
  finShape.moveTo(0, 0)
  finShape.lineTo(-3.4, 8.4)
  finShape.lineTo(-6.4, 8.4)
  finShape.lineTo(-6.2, 0)
  finShape.closePath()
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.32, bevelEnabled: false }), paint)
  fin.rotation.y = Math.PI / 2
  fin.position.set(-8.2, 1.1, 0.16)
  group.add(fin)

  // Horizontal stabilisers
  for (const side of [1, -1]) {
    const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.28, 5.6), skin)
    stabiliser.position.set(-11.4, 0.35, side * 3.1)
    stabiliser.rotation.y = side * 0.22
    group.add(stabiliser)
  }

  // Landing gear
  const legGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1.9, 8)
  const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.34, 16)
  for (const [x, z] of [[7.2, 0], [-2.2, 2.4], [-2.2, -2.4]] as const) {
    const leg = new THREE.Mesh(legGeometry, metal)
    leg.position.set(x, -1.9, z)
    group.add(leg)
    for (const offset of [-0.28, 0.28]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark)
      wheel.rotation.x = Math.PI / 2
      wheel.position.set(x, -2.8, z + offset)
      group.add(wheel)
    }
  }

  return group
}

export default function AircraftViewer({ signal }: { signal: Signal }) {
  const mount = useRef<HTMLDivElement | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const [spinning, setSpinning] = useState(true)
  const livery = liveryFor(signal.title)

  useEffect(() => {
    const element = mount.current
    if (!element) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#07131c')
    scene.fog = new THREE.FogExp2('#07131c', 0.008)

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400)
    camera.position.set(24, 12, 26)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    element.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xd6ecff, 0x0c1a22, 1.1))
    const sun = new THREE.DirectionalLight(0xfff3dc, 2.6)
    sun.position.set(20, 26, 14)
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x6fd2ff, 0.85)
    rim.position.set(-22, 10, -18)
    scene.add(rim)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(90, 64),
      new THREE.MeshStandardMaterial({ color: '#0a1c25', roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -4.2
    scene.add(ground)
    scene.add(new THREE.GridHelper(160, 40, 0x1b4650, 0x102e36))

    scene.add(buildAircraft(livery.body, livery.accent, livery.trim))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 16
    controls.maxDistance = 90
    controls.maxPolarAngle = Math.PI / 1.95
    controls.target.set(0, 0.5, 0)
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.9

    const resize = () => {
      const width = element.clientWidth || 320
      const height = element.clientHeight || 220
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
    controlsRef.current = controls

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
      controlsRef.current = null
    }
  }, [signal.id, livery.body, livery.accent, livery.trim])

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = spinning
  }, [spinning])

  const heading = Number(signal.metrics.heading_deg ?? NaN)
  const altitude = Number(signal.metrics.altitude_m ?? NaN)
  const speed = Number(signal.metrics.speed_kmh ?? NaN)

  return (
    <div className="viewer-wrap aircraft-viewer">
      <div className="viewer-canvas" ref={mount} />
      <div className="viewer-toolbar">
        <button className={spinning ? 'active' : ''} onClick={() => setSpinning(!spinning)}>AUTO</button>
        <button onClick={() => { const controls = controlsRef.current; if (controls) { controls.autoRotate = false; setSpinning(false) } }}>HOLD</button>
      </div>
      <div className="viewer-note">
        PROCEDURAL {livery.code === 'UNK' ? 'AIRLINER' : livery.airline.toUpperCase()} · LIVERY FROM CALLSIGN · DRAG TO ORBIT
      </div>
      <div className="aircraft-readout">
        <span><b>{signal.title}</b> {livery.code === 'UNK' ? 'operator unknown' : livery.airline}</span>
        <span>
          {Number.isFinite(altitude) ? `${Math.round(altitude)} m` : 'alt —'} ·{' '}
          {Number.isFinite(speed) ? `${Math.round(speed)} km/h` : 'speed —'} ·{' '}
          {Number.isFinite(heading) ? `${Math.round(heading)}°` : 'hdg —'}
        </span>
      </div>
    </div>
  )
}
