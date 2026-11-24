import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CityModel } from './citymodel'
import { SECTOR_COLOURS, floodColour, hashUnit, taggedHeight } from './citymodel'

export type CityControls = { forward: number; strafe: number; turn: number; lift: number }
export type CityEnv = { depth: number; rain: boolean }

export type BuildingInfo = { name: string | null; height: number; estimated: boolean; sector: string }

type Props = {
  model: CityModel
  controls: React.RefObject<CityControls>
  env: React.RefObject<CityEnv>
  onReady: () => void
  onPick: (info: BuildingInfo | null, x: number, y: number) => void
}

const ROAD_WIDTH: Record<string, number> = {
  motorway: 26, trunk: 21, primary: 16, secondary: 12, tertiary: 10,
  residential: 7.5, unclassified: 7, living_street: 5.5, pedestrian: 5,
}

const ROAD_COLOUR: Record<string, string> = {
  motorway: '#e3b169', trunk: '#dbab6b', primary: '#c3ccd4', secondary: '#b3bec7',
  tertiary: '#9fabb5', residential: '#7d8b95', unclassified: '#75828c',
  living_street: '#6d7a84', pedestrian: '#6a7a86',
}

type Meta = BuildingInfo

/**
 * Draws the selected place as a real 3D scene: extrusions of OSM footprints,
 * roofs, street ribbons, water and a ground plane. No map tiles are involved,
 * so the satellite view can be hidden once this is ready.
 */
export default function CityScene({ model, controls, env, onReady, onPick }: Props) {
  const host = useRef<HTMLDivElement | null>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
    const element = host.current
    if (!element) return

    const width = element.clientWidth || window.innerWidth
    const height = element.clientHeight || window.innerHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#07131c')
    scene.fog = new THREE.Fog('#07131c', 1100, 3000)

    const camera = new THREE.PerspectiveCamera(68, width / height, 0.4, 6000)
    scene.add(new THREE.HemisphereLight('#d6ecff', '#16242e', 1.05))
    const sun = new THREE.DirectionalLight('#fff3df', 1.25)
    sun.position.set(420, 900, 260)
    scene.add(sun)
    scene.add(new THREE.AmbientLight('#22323d', 0.5))

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.outputColorSpace = THREE.SRGBColorSpace
    element.appendChild(renderer.domElement)

    // --- local metric frame, centred on the model -------------------------
    const [lng0, lat0] = model.centre
    const metresPerLng = 111320 * Math.cos((lat0 * Math.PI) / 180)
    const toLocal = (lng: number, lat: number): [number, number] => [
      (lng - lng0) * metresPerLng,
      -(lat - lat0) * 110540,
    ]

    const positions: number[] = []
    const colours: number[] = []
    const ranges: { start: number; end: number; meta: Meta }[] = []
    const colour = new THREE.Color()
    const roof = new THREE.Color()

    const pushTriangle = (a: [number, number, number], b: [number, number, number], c: [number, number, number], tint: THREE.Color, shade: number[]) => {
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
      colours.push(
        tint.r * shade[0], tint.g * shade[0], tint.b * shade[0],
        tint.r * shade[1], tint.g * shade[1], tint.b * shade[1],
        tint.r * shade[2], tint.g * shade[2], tint.b * shade[2],
      )
    }

    for (const building of model.buildings) {
      const tagged = taggedHeight(building)
      const seed = `${building.ring[0][0]},${building.ring[0][1]},${building.class}`
      const height = tagged ?? 7 + hashUnit(seed) * 9
      const sector = SECTOR_COLOURS[building.class] ? building.class : 'unmapped'
      colour.set(SECTOR_COLOURS[building.class] ?? '#9aa5ad')
      roof.copy(colour).lerp(new THREE.Color('#ffffff'), 0.34)

      const ring = building.ring.map(([lng, lat]) => {
        const local = toLocal(lng, lat)
        return new THREE.Vector2(local[0], local[1])
      })
      if (ring.length < 3) continue

      const startVertex = positions.length / 3

      for (let index = 0; index < ring.length; index += 1) {
        const a = ring[index]
        const b = ring[(index + 1) % ring.length]
        pushTriangle(
          [a.x, 0, a.y], [b.x, 0, b.y], [b.x, height, b.y],
          colour, [0.62, 0.62, 1],
        )
        pushTriangle(
          [a.x, 0, a.y], [b.x, height, b.y], [a.x, height, a.y],
          colour, [0.62, 1, 1],
        )
      }

      let faces: number[][] = []
      try {
        faces = THREE.ShapeUtils.triangulateShape(ring, [])
      } catch {
        faces = []
      }
      for (const [i, j, k] of faces) {
        const a = ring[i]
        const b = ring[j]
        const c = ring[k]
        pushTriangle([a.x, height, a.y], [b.x, height, b.y], [c.x, height, c.y], roof, [1, 1, 1])
      }

      ranges.push({
        start: startVertex,
        end: positions.length / 3,
        meta: {
          name: building.name,
          height: Math.round(height),
          estimated: tagged === null,
          sector: sector === 'unmapped' ? 'unmapped' : building.class,
        },
      })
    }

    // Roads as flat ribbons, drawn just above the ground.
    for (const road of model.roads) {
      const width = ROAD_WIDTH[road.class] ?? 7
      colour.set(ROAD_COLOUR[road.class] ?? '#7d8b95')
      const points = road.line.map(([lng, lat]) => {
        const local = toLocal(lng, lat)
        return new THREE.Vector2(local[0], local[1])
      })
      for (let index = 0; index < points.length - 1; index += 1) {
        const a = points[index]
        const b = points[index + 1]
        const dx = b.x - a.x
        const dz = b.y - a.y
        const len = Math.hypot(dx, dz)
        if (len < 0.5) continue
        const nx = (-dz / len) * (width / 2)
        const nz = (dx / len) * (width / 2)
        const y = 0.12 + (road.class === 'motorway' ? 0.12 : 0)
        positions.push(
          a.x - nx, y, a.y - nz, a.x + nx, y, a.y + nz, b.x + nx, y, b.y + nz,
          a.x - nx, y, a.y - nz, b.x + nx, y, b.y + nz, b.x - nx, y, b.y - nz,
        )
        for (let vertex = 0; vertex < 6; vertex += 1) {
          colours.push(colour.r, colour.g, colour.b)
        }
      }
    }

    // Water polygons, flat and slightly blue.
    colour.set('#0d3550')
    for (const body of model.water) {
      const ring = body.ring.map(([lng, lat]) => {
        const local = toLocal(lng, lat)
        return new THREE.Vector2(local[0], local[1])
      })
      if (ring.length < 3) continue
      let faces: number[][] = []
      try {
        faces = THREE.ShapeUtils.triangulateShape(ring, [])
      } catch {
        faces = []
      }
      for (const [i, j, k] of faces) {
        const a = ring[i]
        const b = ring[j]
        const c = ring[k]
        positions.push(a.x, 0.05, a.y, b.x, 0.05, b.y, c.x, 0.05, c.y)
        for (let vertex = 0; vertex < 3; vertex += 1) colours.push(colour.r, colour.g, colour.b)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3))
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.04,
      side: THREE.DoubleSide,
      flatShading: true,
    })
    const cityMesh = new THREE.Mesh(geometry, material)
    cityMesh.name = 'city'
    scene.add(cityMesh)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4200, 4200),
      new THREE.MeshStandardMaterial({ color: '#0b161d', roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.05
    scene.add(ground)

    const grid = new THREE.GridHelper(4200, 210, 0x1a2e3a, 0x112029)
    grid.position.y = 0.01
    grid.material.opacity = 0.55
    grid.material.transparent = true
    scene.add(grid)

    // Flood scenario water: a translucent sheet the whole city sits in, the
    // depth ramp borrowed from Augma's flood maps. This is a scenario level,
    // never a measured water height.
    const floodMaterial = new THREE.MeshStandardMaterial({
      color: floodColour(0.3),
      transparent: true,
      opacity: 0.52,
      roughness: 0.12,
      metalness: 0.25,
      side: THREE.DoubleSide,
    })
    const flood = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), floodMaterial)
    flood.rotation.x = -Math.PI / 2
    flood.position.y = -2
    flood.visible = false
    scene.add(flood)

    // Rain: a point cloud that follows the camera, wrapping inside a 300 m box.
    const RAIN_COUNT = 2400
    const RAIN_BOX = 300
    const rainPositions = new Float32Array(RAIN_COUNT * 3)
    for (let index = 0; index < RAIN_COUNT; index += 1) {
      rainPositions[index * 3] = (Math.random() - 0.5) * RAIN_BOX * 2
      rainPositions[index * 3 + 1] = Math.random() * 260
      rainPositions[index * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX * 2
    }
    const rainGeometry = new THREE.BufferGeometry()
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3))
    const rainMaterial = new THREE.PointsMaterial({
      color: '#bfe9ff', size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.45,
    })
    const rain = new THREE.Points(rainGeometry, rainMaterial)
    rain.visible = false
    scene.add(rain)

    // --- free-fly camera --------------------------------------------------
    let yaw = Math.PI * 0.12
    let pitch = -0.34
    const target = new THREE.Vector3(0, 6, 0)
    const eye = target.clone().add(new THREE.Vector3(105, 215, 265))

    const applyCamera = () => {
      const direction = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
      )
      camera.position.copy(eye)
      camera.lookAt(eye.clone().add(direction))
    }
    applyCamera()

    let dragging = false
    let dragDistance = 0
    let lastX = 0
    let lastY = 0
    const canvas = renderer.domElement

    const onPointerDown = (event: PointerEvent) => {
      dragging = true
      dragDistance = 0
      lastX = event.clientX
      lastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      dragDistance += Math.abs(dx) + Math.abs(dy)
      yaw -= dx * 0.0035
      pitch = Math.max(-1.15, Math.min(0.9, pitch - dy * 0.0028))
      applyCamera()
    }
    const onPointerUp = (event: PointerEvent) => {
      dragging = false
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      eye.addScaledVector(forward, -event.deltaY * 0.35)
      applyCamera()
    }

    const raycaster = new THREE.Raycaster()
    const onClick = (event: MouseEvent) => {
      if (dragDistance > 5) return
      const rect = canvas.getBoundingClientRect()
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObject(cityMesh, false)[0]
      if (!hit || hit.faceIndex === undefined || hit.faceIndex === null) {
        pickRef.current(null, event.clientX - rect.left, event.clientY - rect.top)
        return
      }
      const vertex = hit.faceIndex * 3
      const found = ranges.find((range) => vertex >= range.start && vertex < range.end)
      pickRef.current(found?.meta ?? null, event.clientX - rect.left, event.clientY - rect.top)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('click', onClick)

    const resize = () => {
      const nextWidth = element.clientWidth || window.innerWidth
      const nextHeight = element.clientHeight || window.innerHeight
      renderer.setSize(nextWidth, nextHeight)
      camera.aspect = nextWidth / nextHeight
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)

    let frame = 0
    let announced = false
    let last = performance.now()
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const now = performance.now()
      const delta = Math.min((now - last) / 1000, 0.05)
      last = now
      const state = controls.current ?? { forward: 0, strafe: 0, turn: 0, lift: 0 }
      const speed = 42 * delta
      if (state.turn) yaw += state.turn * 1.5 * delta
      if (state.forward || state.strafe) {
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
        eye.addScaledVector(forward, state.forward * speed)
        eye.addScaledVector(right, state.strafe * speed)
      }
      if (state.lift) eye.y = Math.max(4, eye.y + state.lift * 55 * delta)
      applyCamera()

      const weather = env.current ?? { depth: 0, rain: false }
      flood.visible = weather.depth > 0.02
      if (flood.visible) {
        flood.position.y = weather.depth
        floodMaterial.color.set(floodColour(weather.depth))
      }
      rain.visible = weather.rain
      if (weather.rain) {
        const attribute = rainGeometry.getAttribute('position') as THREE.BufferAttribute
        const array = attribute.array as Float32Array
        for (let index = 0; index < RAIN_COUNT; index += 1) {
          array[index * 3 + 1] -= 95 * delta
          if (array[index * 3 + 1] < weather.depth) {
            array[index * 3] = (Math.random() - 0.5) * RAIN_BOX * 2
            array[index * 3 + 1] = 200 + Math.random() * 70
            array[index * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX * 2
          }
        }
        attribute.needsUpdate = true
        rain.position.set(eye.x, 0, eye.z)
      }
      renderer.render(scene, camera)
      if (!announced) {
        announced = true
        onReady()
      }
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('click', onClick)
      geometry.dispose()
      material.dispose()
      flood.geometry.dispose()
      floodMaterial.dispose()
      rainGeometry.dispose()
      rainMaterial.dispose()
      ground.geometry.dispose()
      ground.material.dispose()
      grid.geometry.dispose()
      grid.material.dispose()
      renderer.dispose()
      if (canvas.parentElement === element) element.removeChild(canvas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, controls, env])

  return <div className="city-scene" ref={host} />
}
