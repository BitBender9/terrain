const EarthTone = new Float32Array([0.72, 0.52, 0.28, 1])
const HEIGHT_SCALE = 1.0
const LIGHT_DIR = normalize([0.4, 1.0, 0.3])

async function setup()
{
    window.gl = document.querySelector('canvas').getContext('webgl2')
    const [vs, fs] = await Promise.all([
        loadText('glsl/vertex_shader.glsl'),
        loadText('glsl/fragment_shader.glsl'),
    ])
    window.program = compile(vs, fs)
    gl.useProgram(program)
    gl.enable(gl.DEPTH_TEST)
    window.geom = null

    document.querySelector('#submit').addEventListener('click', regenerateTerrain)
    window.addEventListener('resize', fillScreen)
    fillScreen()
    tick(0)
}

/**
 * Compiles two shaders, links them together, looks up their uniform locations,
 * and returns the result. Reports any shader errors to the console.
 *
 * @param {string} vs_source - the source code of the vertex shader
 * @param {string} fs_source - the source code of the fragment shader
 * @return {WebGLProgram} the compiled and linked program
 */
function compile(vs_source, fs_source)
{
    const vs = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vs, vs_source)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
    {
        console.error(gl.getShaderInfoLog(vs))
        throw Error("Vertex shader compilation failed")
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fs, fs_source)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
    {
        console.error(gl.getShaderInfoLog(fs))
        throw Error("Fragment shader compilation failed")
    }

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        console.error(gl.getProgramInfoLog(program))
        throw Error("Linking failed")
    }
    
    const uniforms = {}
    for(let i=0; i<gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i+=1)
    {
        let info = gl.getActiveUniform(program, i)
        uniforms[info.name] = gl.getUniformLocation(program, info.name)
    }
    program.uniforms = uniforms

    return program
}

function supplyDataBuffer(data, loc, mode)
{
    if (mode === undefined) mode = gl.STATIC_DRAW

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    const f32 = new Float32Array(data.flat())
    gl.bufferData(gl.ARRAY_BUFFER, f32, mode)

    gl.vertexAttribPointer(loc, data[0].length, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(loc)

    return buf
}

function setupGeomery(geom)
{
    const triangleArray = gl.createVertexArray()
    gl.bindVertexArray(triangleArray)

    for(let i=0; i<geom.attributes.length; i+=1)
    {
        supplyDataBuffer(geom.attributes[i], i)
    }

    const indices = new Uint16Array(geom.triangles.flat())
    const indexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    return (
    {
        mode: gl.TRIANGLES,
        count: indices.length,
        type: gl.UNSIGNED_SHORT,
        vao: triangleArray
    })
}

function fillScreen()
{
    const canvas = document.querySelector('canvas')
    document.body.style.margin = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    canvas.style.width = ''
    canvas.style.height = ''
    gl.viewport(0, 0, canvas.width, canvas.height)
    window.p = m4perspNegZ(0.1, 10, 1.0, canvas.width, canvas.height)
}

function regenerateTerrain()
{
    const gridsize = Number(document.querySelector('#gridsize').value) || 2
    const faults = Number(document.querySelector('#faults').value) || 0
    const weathering = Number(document.querySelector('#weathering').value) || 0
    window.geom = setupGeomery(generateTerrain(gridsize, faults, weathering))
}

/**
 * Build a gridsize-by-gridsize heightfield with faulting or a hemisphere.
 */
function generateTerrain(gridsize, faults, weathering)
{
    const n = gridsize
    const positions = new Array(n * n)
    const step = n === 1 ? 0 : 2 / (n - 1)

    for(let row=0; row<n; row+=1)
    {
        for(let col=0; col<n; col+=1)
        {
            const x = -1 + col * step
            const z = -1 + row * step
            positions[row * n + col] = [x, 0, z]
        }
    }

    if (faults <= 0)
    {
        const r = 1
        for(let i=0; i<positions.length; i+=1)
        {
            const x = positions[i][0]
            const z = positions[i][2]
            const d = Math.sqrt(x * x + z * z)
            positions[i][1] = (r >= d) ? Math.sqrt(r * r - d * d) : 0
        }
    }
    else
    {
        const R = Math.SQRT2
        for(let f=0; f<faults; f+=1)
        {
            const theta = Math.random() * Math.PI * 2
            const a = Math.cos(theta)
            const b = Math.sin(theta)
            const d = (Math.random() * 2 - 1) * R
            for(let i=0; i<positions.length; i+=1)
            {
                const x = positions[i][0]
                const z = positions[i][2]
                if (a * x + b * z > d)
                {
                    positions[i][1] += 1
                }
                else
                {
                    positions[i][1] -= 1
                }
            }
        }

        let minH = Infinity
        let maxH = -Infinity
        for(let i=0; i<positions.length; i+=1)
        {
            const h = positions[i][1]
            if (h < minH) minH = h
            if (h > maxH) maxH = h
        }
        const range = maxH - minH
        if (range > 0)
        {
            const mid = 0.5 * (maxH + minH)
            for(let i=0; i<positions.length; i+=1)
            {
                positions[i][1] = HEIGHT_SCALE * (positions[i][1] - mid) / range
            }
        }
    }

    applyWeathering(positions, n, weathering)

    const normals = computeGridNormals(positions, n)
    const triangles = []
    for(let row=0; row<n-1; row+=1)
    {
        for(let col=0; col<n-1; col+=1)
        {
            const i = row * n + col
            triangles.push([i, i + n, i + 1])
            triangles.push([i + 1, i + n, i + n + 1])
        }
    }

    return (
    {
        triangles: triangles,
        attributes: [positions, normals]
    })
}

/**
 * Spheroidal weathering: height-only Laplacian smooth, p' = (p + m) / 2,
 * two-pass per iteration so updates don't bias the result.
 */
function applyWeathering(positions, n, iterations)
{
    const passes = Math.max(0, Math.floor(iterations))
    for(let iter=0; iter<passes; iter+=1)
    {
        const nextHeights = new Array(n * n)
        for(let row=0; row<n; row+=1)
        {
            for(let col=0; col<n; col+=1)
            {
                const i = row * n + col
                let sum = 0
                let count = 0
                if (row > 0)
                {
                    sum += positions[i - n][1]
                    count += 1
                }
                if (row < n - 1)
                {
                    sum += positions[i + n][1]
                    count += 1
                }
                if (col > 0)
                {
                    sum += positions[i - 1][1]
                    count += 1
                }
                if (col < n - 1)
                {
                    sum += positions[i + 1][1]
                    count += 1
                }
                const m = sum / count
                nextHeights[i] = 0.5 * (positions[i][1] + m)
            }
        }
        for(let i=0; i<positions.length; i+=1)
        {
            positions[i][1] = nextHeights[i]
        }
    }
}

/**
 * Grid-based normals: (n - s) x (w - e), using v for missing neighbors.
 * Row 0 is north (-Z) so the cross product points +Y on a flat grid.
 */
function computeGridNormals(positions, n)
{
    const normals = new Array(n * n)
    for(let row=0; row<n; row+=1)
    {
        for(let col=0; col<n; col+=1)
        {
            const i = row * n + col
            const v = positions[i]
            const north = (row > 0) ? positions[i - n] : v
            const south = (row < n - 1) ? positions[i + n] : v
            const east = (col < n - 1) ? positions[i + 1] : v
            const west = (col > 0) ? positions[i - 1] : v
            normals[i] = normalize(cross(sub(north, south), sub(west, east)))
        }
    }
    return normals
}

function draw(seconds)
{
    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    if (!window.geom) return

    gl.bindVertexArray(geom.vao)

    gl.uniform4fv(program.uniforms.color, EarthTone)
    gl.uniform3fv(program.uniforms.lightdir, LIGHT_DIR)
    gl.uniform3fv(program.uniforms.lightcolor, [1, 1, 1])

    const radius = 2.2
    const eyeY = HEIGHT_SCALE * 0.5 + 0.35
    const eye = [radius * Math.cos(seconds / 2), eyeY, radius * Math.sin(seconds / 2)]
    gl.uniform3fv(program.uniforms.eyepos, eye)

    const v = m4view(eye, [0, 0, 0], [0, 1, 0])
    gl.uniformMatrix4fv(program.uniforms.mv, false, v)
    gl.uniformMatrix4fv(program.uniforms.p, false, p)

    gl.drawElements(geom.mode, geom.count, geom.type, 0)
}

function tick(milliseconds)
{
    const seconds = milliseconds / 1000
    draw(seconds)
    requestAnimationFrame(tick)
}

async function loadText(path)
{
    const res = await fetch(path)
    if (!res.ok)
    {
        throw Error('Failed to load ' + path + ' (open this page via http://localhost, not as a file)')
    }
    return res.text()
}

window.addEventListener('load', setup)
