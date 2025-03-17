import { SplattedVertex } from './SplattedVertex';
export class PlyParser {
    private header: string[] = [];
    private format: string = '';
    private numVertices: number = 0;
    private properties: { name: string; type: string }[] = [];
    private headerLength: number = 0;
    private rawVertices: any[] = [];
    private splattifiedVertices: SplattedVertex[] = [];

    async parsePlyFile(file: File) {
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder();
        let headerText = '';
        const chunk = new Uint8Array(buffer, 0, Math.min(2048, buffer.byteLength)); // 2048 is probably enough to get the end header
        
        // Find the end of the header first
        headerText = decoder.decode(chunk);
        const headerEndIndex = headerText.indexOf('end_header\n');
        if (headerEndIndex === -1) {
            throw new Error('Invalid PLY file: Cannot find end of header');
        }
        this.headerLength = headerEndIndex + 11; // 11 is length of 'end_header\n'
        
        // Parse header
        const headerLines = headerText.slice(0, headerEndIndex).split('\n').map(line => line.trim());
        let i = 0;
        if (headerLines[i] !== 'ply') {
            throw new Error('Invalid PLY file: Missing "ply" header');
        }
        
        i++;
        while (i < headerLines.length) {
            const line = headerLines[i];
            this.header.push(line);
            
            if (line.startsWith('format')) {
                this.format = line.split(' ')[1];
            } else if (line.startsWith('element vertex')) {
                this.numVertices = parseInt(line.split(' ')[2]);
            } else if (line.startsWith('property')) {
                const parts = line.split(' ');
                this.properties.push({
                    name: parts[2],
                    type: parts[1]
                });
            }
            i++;
        }

        // Parse vertex data based on format
        if (this.format === 'binary_little_endian') {
            this.rawVertices = this.parseBinary(buffer);
        } else {
            throw new Error(`Unsupported PLY format: ${this.format}`);
        }

        this.splattifiedVertices = this.splatifyVertices(this.rawVertices);
    }

    private parseBinary(buffer: ArrayBuffer): any[] {
        const dataView = new DataView(buffer);
        const vertices: any[] = [];
        let offset = this.headerLength;

        for (let v = 0; v < this.numVertices; v++) {
            const vertex: any = {};
            
            for (const prop of this.properties) {
                const value = this.readBinaryValue(dataView, offset, prop.type);
                vertex[prop.name] = value;
                offset += this.getTypeSize(prop.type);
            }
            
            vertices.push(vertex);
        }

        return vertices;
    }

    private splatifyVertices(vertices: any[]) {
        const SH_C0 = 0.28209479177387814;
        const splattedVertices: SplattedVertex[] = [];
        for (const vertex of vertices) {
            const splattedVertex:SplattedVertex = new SplattedVertex(
                [vertex.x, vertex.y, vertex.z],
                [vertex.rot_0, vertex.rot_1, vertex.rot_2, vertex.rot_3],
                [Math.exp(vertex.scale_0), Math.exp(vertex.scale_1), Math.exp(vertex.scale_2)],
                [0.5 + SH_C0 * vertex.f_dc_0, 0.5 + SH_C0 * vertex.f_dc_1, 0.5 + SH_C0 * vertex.f_dc_2],
                1.0 / (1.0 + Math.exp(-vertex.opacity))
            );
            splattedVertices.push(splattedVertex);
        }
        return splattedVertices;
    }

    private readBinaryValue(dataView: DataView, offset: number, type: string): number {
        switch (type) {
            case 'float':
            case 'float32':
                return dataView.getFloat32(offset, true);
            case 'float64':
            case 'double':
                return dataView.getFloat64(offset, true);
            case 'int8':
                return dataView.getInt8(offset);
            case 'uint8':
                return dataView.getUint8(offset);
            case 'int16':
                return dataView.getInt16(offset, true);
            case 'uint16':
                return dataView.getUint16(offset, true);
            case 'int32':
                return dataView.getInt32(offset, true);
            case 'uint32':
                return dataView.getUint32(offset, true);
            default:
                throw new Error(`Unsupported binary type: ${type}`);
        }
    }

    private getTypeSize(type: string): number {
        switch (type) {
            case 'int8':
            case 'uint8':
                return 1;
            case 'int16':
            case 'uint16':
                return 2;
            case 'int32':
            case 'uint32':
            case 'float':
            case 'float32':
                return 4;
            case 'float64':
            case 'double':
                return 8;
            default:
                throw new Error(`Unknown type size for: ${type}`);
        }
    }

    getSplattifiedVertices(): SplattedVertex[] {
        return this.splattifiedVertices;
    }
} 