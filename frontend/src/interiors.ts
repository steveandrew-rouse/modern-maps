import * as THREE from 'three'
import type { LandmarkKind } from './landmarks'

/**
 * Interpretive interiors. These are built from published descriptions of each
 * building — plan, materials, and the elements visitors actually see — not from
 * photographs or measured surveys. They are deliberately schematic: enough to
 * walk through and read the space, not a reconstruction.
 */

function surface(colour: string, roughness = 0.8, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness, metalness })
}

function solid(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  return mesh
}

function column(radius: number, height: number, material: THREE.Material, x: number, z: number) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 20), material)
  shaft.position.set(x, height / 2, z)
  return shaft
}

function lamp(x: number, y: number, z: number) {
  const group = new THREE.Group()
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 10),
    new THREE.MeshStandardMaterial({ color: '#ffe6b0', emissive: '#ffcf7a', emissiveIntensity: 1.8 }),
  )
  bulb.position.set(x, y, z)
  group.add(bulb)
  const light = new THREE.PointLight('#ffd79a', 2.2, 16, 2)
  light.position.set(x, y - 0.3, z)
  group.add(light)
  return group
}

export function buildInterior(kind: LandmarkKind): THREE.Group {
  const group = new THREE.Group()
  const plaster = surface('#e3d9c6', 0.92)
  const marble = surface('#efe9dd', 0.45, 0.08)
  const sandstone = surface('#b4603f', 0.88)
  const floorStone = surface('#2f2a24', 0.95)
  const gold = surface('#d8a92e', 0.25, 0.9)
  const dark = surface('#241a12', 0.9)
  const glass = new THREE.MeshStandardMaterial({
    color: '#cfe8ff', transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.2,
  })

  const floor = (size: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.01
    group.add(mesh)
  }

  switch (kind) {
    case 'taj': {
      // Octagonal crypt: jali screens around a central cenotaph.
      floor(26, floorStone)
      group.add(solid(16, 0.3, 16, marble, 0, 0.15, 0))
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2
        const radius = 7
        const screen = solid(4.6, 3.4, 0.16, marble, Math.cos(angle) * radius, 1.7, Math.sin(angle) * radius)
        screen.rotation.y = -angle
        group.add(screen)
        for (let j = -2; j <= 2; j += 1) {
          const bar = solid(0.12, 3, 0.1, dark, Math.cos(angle) * (radius - 0.1) + Math.cos(angle + Math.PI / 2) * j * 0.85, 1.6, Math.sin(angle) * (radius - 0.1) + Math.sin(angle + Math.PI / 2) * j * 0.85)
          bar.rotation.y = -angle
          group.add(bar)
        }
      }
      group.add(solid(3.4, 0.7, 3.4, marble, 0, 0.65, 0))
      group.add(solid(2.8, 0.5, 2.8, marble, 0, 1.25, 0))
      group.add(solid(2.2, 0.16, 2.2, gold, 0, 1.6, 0))
      group.add(lamp(0, 3.4, 0))
      group.add(lamp(4.2, 2.6, 3.4))
      group.add(lamp(-4.2, 2.6, -3.4))
      break
    }
    case 'gate': {
      // Memorial colonnade with the Amar Jawan flame at the far end.
      floor(40, floorStone)
      group.add(solid(24, 0.24, 12, marble, 0, 0.12, 0))
      for (const side of [-1, 1]) {
        for (let i = -3; i <= 3; i += 1) {
          group.add(column(0.42, 6, sandstone, i * 3, side * 5.2))
          group.add(solid(0.9, 0.3, 0.9, sandstone, i * 3, 6.1, side * 5.2))
        }
        group.add(solid(22, 0.7, 0.9, sandstone, 0, 6.6, side * 5.2))
        for (let i = -3; i <= 2; i += 1) {
          const name = solid(1.6, 0.3, 0.05, dark, i * 3 + 1.5, 3.4, side * 5.7)
          group.add(name)
        }
      }
      group.add(solid(24, 0.5, 12, sandstone, 0, 7.2, 0))
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.6, 14),
        new THREE.MeshStandardMaterial({ color: '#ffb057', emissive: '#ff7a00', emissiveIntensity: 2.2 }),
      )
      flame.position.set(0, 1.1, -3.4)
      group.add(flame)
      group.add(lamp(0, 3.4, 0))
      group.add(lamp(8, 3.2, 2))
      group.add(lamp(-8, 3.2, -2))
      break
    }
    case 'tower': {
      // Qutub complex courtyard: colonnade ring around the base of the minar.
      floor(44, floorStone)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.4, 40), sandstone)
      base.position.set(0, 0.2, 0)
      group.add(base)
      for (let i = 0; i < 16; i += 1) {
        const angle = (i / 16) * Math.PI * 2
        group.add(column(0.34, 4.4, sandstone, Math.cos(angle) * 13, Math.sin(angle) * 13))
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(13, 0.35, 8, 64), sandstone)
      ring.rotation.x = Math.PI / 2
      ring.position.set(0, 4.5, 0)
      group.add(ring)
      group.add(solid(1.2, 2.4, 0.4, dark, 0, 1.2, 3.5))
      group.add(lamp(0, 3.6, 0))
      break
    }
    case 'palace': {
      // Durbar hall: two rows of pillars, dais and chandeliers.
      floor(34, floorStone)
      group.add(solid(20, 0.3, 14, marble, 0, 0.15, 0))
      for (const side of [-1, 1]) {
        for (let i = -2; i <= 2; i += 1) {
          group.add(column(0.36, 6.4, sandstone, i * 4, side * 5))
          group.add(solid(1.1, 0.35, 1.1, gold, i * 4, 6.5, side * 5))
        }
      }
      group.add(solid(20, 0.6, 14, plaster, 0, 7.2, 0))
      group.add(solid(6, 0.5, 4, marble, 0, 0.5, -4))
      group.add(solid(2.6, 2.6, 1.2, gold, 0, 1.9, -4))
      for (const x of [-5, 0, 5]) group.add(lamp(x, 5.4, 0))
      break
    }
    case 'minaret': {
      // Spiral stair inside the shaft.
      floor(14, floorStone)
      const wallMaterial = new THREE.MeshStandardMaterial({ color: '#8e5b45', roughness: 0.95, side: THREE.BackSide })
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 22, 40, 1, true), wallMaterial)
      wall.position.y = 11
      group.add(wall)
      for (let i = 0; i < 44; i += 1) {
        const angle = i * 0.42
        const step = solid(1.6, 0.24, 0.8, sandstone, Math.cos(angle) * 2.4, 0.35 + i * 0.46, Math.sin(angle) * 2.4)
        step.rotation.y = -angle
        group.add(step)
      }
      group.add(lamp(0, 4, 0))
      break
    }
    case 'temple': {
      // Sanctum around the Guru Granth Sahib under a gold canopy.
      floor(30, marble)
      group.add(solid(18, 0.3, 14, marble, 0, 0.15, 0))
      for (const side of [-1, 1]) {
        for (let i = -1; i <= 1; i += 1) {
          group.add(column(0.3, 4.6, gold, i * 5, side * 5))
        }
      }
      group.add(solid(18, 0.4, 14, plaster, 0, 5.2, 0))
      group.add(solid(4.2, 0.9, 3, marble, 0, 0.75, -3))
      group.add(solid(3.4, 1.2, 2.4, gold, 0, 1.8, -3))
      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.35, 24), gold)
      canopy.position.set(0, 4.2, -3)
      group.add(canopy)
      group.add(lamp(0, 3.4, 0))
      group.add(lamp(5, 2.8, 3))
      group.add(lamp(-5, 2.8, 3))
      group.add(solid(26, 5, 0.3, glass, 0, 2.5, 9))
      break
    }
  }

  return group
}
