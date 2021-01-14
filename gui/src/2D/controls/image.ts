import { Nullable } from "babylonjs/types";
import { Observable } from "babylonjs/Misc/observable";
import { Tools } from "babylonjs/Misc/tools";

import { Control } from "./control";
import { Measure } from "../measure";
import { _TypeStore } from "babylonjs/Misc/typeStore";
import { serialize } from "babylonjs/Misc/decorators";

/**
 * Class used to create 2D images
 */
export class Image extends Control {
    private _workingCanvas: Nullable<HTMLCanvasElement> = null;

    private _domImage: HTMLImageElement;
    private _imageWidth: number;
    private _imageHeight: number;
    private _loaded = false;
    private _stretch = Image.STRETCH_FILL;
    private _source: Nullable<string>;
    private _autoScale = false;

    private _sourceLeft = 0;
    private _sourceTop = 0;
    private _sourceWidth = 0;
    private _sourceHeight = 0;
    private _svgAttributesComputationCompleted: boolean = false;
    private _isSVG: boolean = false;

    private _cellWidth: number = 0;
    private _cellHeight: number = 0;
    private _cellId: number = -1;

    private _sliceLeft: number;
    private _sliceRight: number;
    private _sliceTop: number;
    private _sliceBottom: number;

    private _detectPointerOnOpaqueOnly: boolean;

    private _imageDataCache: {
        data: Uint8ClampedArray | null;
        key: string;
    } = { data: null, key: "" };

    /**
     * Observable notified when the content is loaded
     */
    public onImageLoadedObservable = new Observable<Image>();

    /**
     * Observable notified when _sourceLeft, _sourceTop, _sourceWidth and _sourceHeight are computed
     */
    public onSVGAttributesComputedObservable = new Observable<Image>();

    /**
     * Gets a boolean indicating that the content is loaded
     */
    public get isLoaded(): boolean {
        return this._loaded;
    }

    /**
     * Gets or sets a boolean indicating if pointers should only be validated on pixels with alpha > 0.
     * Beware using this as this will comsume more memory as the image has to be stored twice
     */
    @serialize()
    public get detectPointerOnOpaqueOnly(): boolean {
        return this._detectPointerOnOpaqueOnly;
    }

    public set detectPointerOnOpaqueOnly(value: boolean) {
        if (this._detectPointerOnOpaqueOnly === value) {
            return;
        }

        this._detectPointerOnOpaqueOnly = value;
    }

    /**
     * Gets or sets the left value for slicing (9-patch)
     */
    @serialize()
    public get sliceLeft(): number {
        return this._sliceLeft;
    }

    public set sliceLeft(value: number) {
        if (this._sliceLeft === value) {
            return;
        }

        this._sliceLeft = value;

        this._markAsDirty();
    }

    /**
     * Gets or sets the right value for slicing (9-patch)
     */
    @serialize()
    public get sliceRight(): number {
        return this._sliceRight;
    }

    public set sliceRight(value: number) {
        if (this._sliceRight === value) {
            return;
        }

        this._sliceRight = value;

        this._markAsDirty();
    }

    /**
     * Gets or sets the top value for slicing (9-patch)
     */
    @serialize()
    public get sliceTop(): number {
        return this._sliceTop;
    }

    public set sliceTop(value: number) {
        if (this._sliceTop === value) {
            return;
        }

        this._sliceTop = value;

        this._markAsDirty();
    }

    /**
     * Gets or sets the bottom value for slicing (9-patch)
     */
    @serialize()
    public get sliceBottom(): number {
        return this._sliceBottom;
    }

    public set sliceBottom(value: number) {
        if (this._sliceBottom === value) {
            return;
        }

        this._sliceBottom = value;

        this._markAsDirty();
    }

    /**
     * Gets or sets the left coordinate in the source image
     */
    @serialize()
    public get sourceLeft(): number {
        return this._sourceLeft;
    }

    public set sourceLeft(value: number) {
        if (this._sourceLeft === value) {
            return;
        }

        this._sourceLeft = value;

        this._markAsDirty();
    }

    /**
     * Gets or sets the top coordinate in the source image
     */
    @serialize()
    public get sourceTop(): number {
        return this._sourceTop;
    }

    public set sourceTop(value: number) {
        if (this._sourceTop === value) {
            return;
        }

        this._sourceTop = value;

        this._markAsDirty();
    }

    /**
     * Gets or sets the width to capture in the source image
     */
    @serialize()
    public get sourceWidth(): number {
        return this._sourceWidth;
    }

    public set sourceWidth(value: number) {
        if (this._sourceWidth === value) {
            return;
        }

        this._sourceWidth = value;

        this._markAsDirty();
    }

    /**
     * Gets or sets the height to capture in the source image
     */
    @serialize()
    public get sourceHeight(): number {
        return this._sourceHeight;
    }

    public set sourceHeight(value: number) {
        if (this._sourceHeight === value) {
            return;
        }

        this._sourceHeight = value;

        this._markAsDirty();
    }

    /** Indicates if the format of the image is SVG */
    public get isSVG(): boolean {
        return this._isSVG;
    }

    /** Gets the status of the SVG attributes computation (sourceLeft, sourceTop, sourceWidth, sourceHeight) */
    public get svgAttributesComputationCompleted(): boolean {
        return this._svgAttributesComputationCompleted;
    }

    /**
     * Gets or sets a boolean indicating if the image can force its container to adapt its size
     * @see https://doc.babylonjs.com/how_to/gui#image
     */
    @serialize()
    public get autoScale(): boolean {
        return this._autoScale;
    }

    public set autoScale(value: boolean) {
        if (this._autoScale === value) {
            return;
        }

        this._autoScale = value;

        if (value && this._loaded) {
            this.synchronizeSizeWithContent();
        }
    }

    /** Gets or sets the streching mode used by the image */
    @serialize()
    public get stretch(): number {
        return this._stretch;
    }

    public set stretch(value: number) {
        if (this._stretch === value) {
            return;
        }

        this._stretch = value;

        this._markAsDirty();
    }

    /** @hidden */
    public _rotate90(n: number, preserveProperties: boolean = false): Image {
        let canvas = document.createElement("canvas");

        const context = canvas.getContext("2d")!;
        const width = this._domImage.width;
        const height = this._domImage.height;

        canvas.width = height;
        canvas.height = width;

        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate((n * Math.PI) / 2);

        context.drawImage(this._domImage, 0, 0, width, height, -width / 2, -height / 2, width, height);

        const dataUrl: string = canvas.toDataURL("image/jpg");
        const rotatedImage = new Image(this.name + "rotated", dataUrl);

        if (preserveProperties) {
            rotatedImage._stretch = this._stretch;
            rotatedImage._autoScale = this._autoScale;
            rotatedImage._cellId = this._cellId;
            rotatedImage._cellWidth = n % 1 ? this._cellHeight : this._cellWidth;
            rotatedImage._cellHeight = n % 1 ? this._cellWidth : this._cellHeight;
        }

        this._handleRotationForSVGImage(this, rotatedImage, n);

        this._imageDataCache.data = null;

        return rotatedImage;
    }

    private _handleRotationForSVGImage(srcImage: Image, dstImage: Image, n: number): void {
        if (!srcImage._isSVG) {
            return;
        }

        if (srcImage._svgAttributesComputationCompleted) {
            this._rotate90SourceProperties(srcImage, dstImage, n);
            this._markAsDirty();
        } else {
            srcImage.onSVGAttributesComputedObservable.addOnce(() => {
                this._rotate90SourceProperties(srcImage, dstImage, n);
                this._markAsDirty();
            });
        }
    }

    private _rotate90SourceProperties(srcImage: Image, dstImage: Image, n: number): void {
        let srcLeft = srcImage.sourceLeft,
            srcTop = srcImage.sourceTop,
            srcWidth = srcImage.domImage.width,
            srcHeight = srcImage.domImage.height;

        let dstLeft = srcLeft,
            dstTop = srcTop,
            dstWidth = srcImage.sourceWidth,
            dstHeight = srcImage.sourceHeight;

        if (n != 0) {
            let mult = n < 0 ? -1 : 1;
            n = n % 4;
            for (let i = 0; i < Math.abs(n); ++i) {
                dstLeft = -(srcTop - srcHeight / 2) * mult + srcHeight / 2;
                dstTop = (srcLeft - srcWidth / 2) * mult + srcWidth / 2;
                [dstWidth, dstHeight] = [dstHeight, dstWidth];
                if (n < 0) {
                    dstTop -= dstHeight;
                } else {
                    dstLeft -= dstWidth;
                }
                srcLeft = dstLeft;
                srcTop = dstTop;
                [srcWidth, srcHeight] = [srcHeight, srcWidth];
            }
        }

        dstImage.sourceLeft = dstLeft;
        dstImage.sourceTop = dstTop;
        dstImage.sourceWidth = dstWidth;
        dstImage.sourceHeight = dstHeight;
    }

    /**
     * Gets or sets the internal DOM image used to render the control
     */
    public set domImage(value: HTMLImageElement) {
        this._domImage = value;
        this._loaded = false;
        this._imageDataCache.data = null;

        if (this._domImage.width) {
            this._onImageLoaded();
        } else {
            this._domImage.onload = () => {
                this._onImageLoaded();
            };
        }
    }

    public get domImage(): HTMLImageElement {
        return this._domImage;
    }

    private _onImageLoaded(): void {
        this._imageDataCache.data = null;
        this._imageWidth = this._domImage.width;
        this._imageHeight = this._domImage.height;
        this._loaded = true;

        // if (this._populateNinePatchSlicesFromImage) {
        //     this._extractNinePatchSliceDataFromImage();
        // }

        if (this._autoScale) {
            this.synchronizeSizeWithContent();
        }

        this.onImageLoadedObservable.notifyObservers(this);

        this._markAsDirty();
    }

    /**
     * Gets the image source url
     */
    @serialize()
    public get source() {
        return this._source;
    }

    /**
     * Gets or sets image source url
     */
    public set source(value: Nullable<string>) {
        if (this._source === value) {
            return;
        }

        this._loaded = false;
        this._source = value;
        this._imageDataCache.data = null;

        if (value) {
            value = this._svgCheck(value);
        }

        this._domImage = document.createElement("img");

        this._domImage.onload = () => {
            this._onImageLoaded();
        };
        if (value) {
            Tools.SetCorsBehavior(value, this._domImage);
            this._domImage.src = value;
        }
    }

    /**
     * Checks for svg document with icon id present
     */
    private _svgCheck(value: string): string {
        if (window.SVGSVGElement && value.search(/.svg#/gi) !== -1 && value.indexOf("#") === value.lastIndexOf("#")) {
            this._isSVG = true;
            var svgsrc = value.split("#")[0];
            var elemid = value.split("#")[1];
            // check if object alr exist in document
            var svgExist = <HTMLObjectElement>document.body.querySelector('object[data="' + svgsrc + '"]');
            if (svgExist) {
                var svgDoc = svgExist.contentDocument;
                // get viewbox width and height, get svg document width and height in px
                if (svgDoc && svgDoc.documentElement) {
                    var vb = svgDoc.documentElement.getAttribute("viewBox");
                    var docwidth = Number(svgDoc.documentElement.getAttribute("width"));
                    var docheight = Number(svgDoc.documentElement.getAttribute("height"));
                    var elem = <SVGGraphicsElement>(<unknown>svgDoc.getElementById(elemid));
                    if (elem && vb && docwidth && docheight) {
                        this._getSVGAttribs(svgExist, elemid);
                        return value;
                    }
                }

                // wait for object to load
                svgExist.addEventListener("load", () => {
                    this._getSVGAttribs(svgExist, elemid);
                });
            } else {
                // create document object
                var svgImage = document.createElement("object");
                svgImage.data = svgsrc;
                svgImage.type = "image/svg+xml";
                svgImage.width = "0%";
                svgImage.height = "0%";
                document.body.appendChild(svgImage);
                // when the object has loaded, get the element attribs
                svgImage.onload = () => {
                    var svgobj = <HTMLObjectElement>document.body.querySelector('object[data="' + svgsrc + '"]');
                    if (svgobj) {
                        this._getSVGAttribs(svgobj, elemid);
                    }
                };
            }
            return svgsrc;
        } else {
            return value;
        }
    }

    /**
     * Sets sourceLeft, sourceTop, sourceWidth, sourceHeight automatically
     * given external svg file and icon id
     */
    private _getSVGAttribs(svgsrc: HTMLObjectElement, elemid: string) {
        var svgDoc = svgsrc.contentDocument;
        // get viewbox width and height, get svg document width and height in px
        if (svgDoc && svgDoc.documentElement) {
            var vb = svgDoc.documentElement.getAttribute("viewBox");
            var docwidth = Number(svgDoc.documentElement.getAttribute("width"));
            var docheight = Number(svgDoc.documentElement.getAttribute("height"));
            // get element bbox and matrix transform
            var elem = svgDoc.getElementById(elemid) as Nullable<SVGGraphicsElement>;
            if (vb && docwidth && docheight && elem) {
                var vb_width = Number(vb.split(" ")[2]);
                var vb_height = Number(vb.split(" ")[3]);
                var elem_bbox = elem.getBBox();
                var elem_matrix_a = 1;
                var elem_matrix_d = 1;
                var elem_matrix_e = 0;
                var elem_matrix_f = 0;
                if (elem.transform && elem.transform.baseVal.consolidate()) {
                    elem_matrix_a = elem.transform.baseVal.consolidate().matrix.a;
                    elem_matrix_d = elem.transform.baseVal.consolidate().matrix.d;
                    elem_matrix_e = elem.transform.baseVal.consolidate().matrix.e;
                    elem_matrix_f = elem.transform.baseVal.consolidate().matrix.f;
                }

                // compute source coordinates and dimensions
                this.sourceLeft = ((elem_matrix_a * elem_bbox.x + elem_matrix_e) * docwidth) / vb_width;
                this.sourceTop = ((elem_matrix_d * elem_bbox.y + elem_matrix_f) * docheight) / vb_height;
                this.sourceWidth = elem_bbox.width * elem_matrix_a * (docwidth / vb_width);
                this.sourceHeight = elem_bbox.height * elem_matrix_d * (docheight / vb_height);
                this._svgAttributesComputationCompleted = true;
                this.onSVGAttributesComputedObservable.notifyObservers(this);
            }
        }
    }

    /**
     * Gets or sets the cell width to use when animation sheet is enabled
     * @see https://doc.babylonjs.com/how_to/gui#image
     */
    get cellWidth(): number {
        return this._cellWidth;
    }
    set cellWidth(value: number) {
        if (this._cellWidth === value) {
            return;
        }

        this._cellWidth = value;
        this._markAsDirty();
    }

    /**
     * Gets or sets the cell height to use when animation sheet is enabled
     * @see https://doc.babylonjs.com/how_to/gui#image
     */
    get cellHeight(): number {
        return this._cellHeight;
    }
    set cellHeight(value: number) {
        if (this._cellHeight === value) {
            return;
        }

        this._cellHeight = value;
        this._markAsDirty();
    }

    /**
     * Gets or sets the cell id to use (this will turn on the animation sheet mode)
     * @see https://doc.babylonjs.com/how_to/gui#image
     */
    get cellId(): number {
        return this._cellId;
    }
    set cellId(value: number) {
        if (this._cellId === value) {
            return;
        }

        this._cellId = value;
        this._markAsDirty();
    }

    /**
     * Creates a new Image
     * @param name defines the control name
     * @param url defines the image url
     */
    constructor(public name?: string, url: Nullable<string> = null) {
        super(name);
        this.source = url;
    }

    /**
     * Tests if a given coordinates belong to the current control
     * @param x defines x coordinate to test
     * @param y defines y coordinate to test
     * @returns true if the coordinates are inside the control
     */
    public contains(x: number, y: number): boolean {
        if (!super.contains(x, y)) {
            return false;
        }

        if (!this._detectPointerOnOpaqueOnly || !this._workingCanvas) {
            return true;
        }

        const width = this._currentMeasure.width | 0;
        const height = this._currentMeasure.height | 0;
        const key = width + "_" + height;

        let imageData = this._imageDataCache.data;

        if (!imageData || this._imageDataCache.key !== key) {
            const canvas = this._workingCanvas;
            const context = canvas.getContext("2d")!;

            this._imageDataCache.data = imageData = context.getImageData(0, 0, width, height).data;
            this._imageDataCache.key = key;
        }

        x = (x - this._currentMeasure.left) | 0;
        y = (y - this._currentMeasure.top) | 0;

        const pickedPixel = imageData[(x + y * width) * 4 + 3];

        return pickedPixel > 0;
    }

    protected _getTypeName(): string {
        return "Image";
    }

    /** Force the control to synchronize with its content */
    public synchronizeSizeWithContent() {
        if (!this._loaded) {
            return;
        }

        this.width = this._domImage.width + "px";
        this.height = this._domImage.height + "px";
    }

    protected _processMeasures(parentMeasure: Measure, context: CanvasRenderingContext2D): void {
        if (this._loaded) {
            switch (this._stretch) {
                case Image.STRETCH_NONE:
                    break;
                case Image.STRETCH_FILL:
                    break;
                case Image.STRETCH_UNIFORM:
                    break;
                case Image.STRETCH_NINE_PATCH:
                    break;
                case Image.STRETCH_EXTEND:
                    if (this._autoScale) {
                        this.synchronizeSizeWithContent();
                    }
                    if (this.parent && this.parent.parent) {
                        // Will update root size if root is not the top root
                        this.parent.adaptWidthToChildren = true;
                        this.parent.adaptHeightToChildren = true;
                    }
                    break;
            }
        }

        super._processMeasures(parentMeasure, context);
    }

    private _prepareWorkingCanvasForOpaqueDetection() {
        if (!this._detectPointerOnOpaqueOnly) {
            return;
        }

        if (!this._workingCanvas) {
            this._workingCanvas = document.createElement("canvas");
        }
        const canvas = this._workingCanvas;
        const width = this._currentMeasure.width;
        const height = this._currentMeasure.height;
        const context = canvas.getContext("2d")!;

        canvas.width = width;
        canvas.height = height;

        context.clearRect(0, 0, width, height);
    }

    private _drawImage(context: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, tx: number, ty: number, tw: number, th: number) {
        context.drawImage(this._domImage, sx, sy, sw, sh, tx, ty, tw, th);

        if (!this._detectPointerOnOpaqueOnly) {
            return;
        }

        const canvas = this._workingCanvas!;
        context = canvas.getContext("2d")!;

        context.drawImage(this._domImage, sx, sy, sw, sh, tx - this._currentMeasure.left, ty - this._currentMeasure.top, tw, th);
    }

    public _draw(context: CanvasRenderingContext2D): void {
        context.save();

        if (this.shadowBlur || this.shadowOffsetX || this.shadowOffsetY) {
            context.shadowColor = this.shadowColor;
            context.shadowBlur = this.shadowBlur;
            context.shadowOffsetX = this.shadowOffsetX;
            context.shadowOffsetY = this.shadowOffsetY;
        }

        let x, y, width, height;
        if (this.cellId == -1) {
            x = this._sourceLeft;
            y = this._sourceTop;

            width = this._sourceWidth ? this._sourceWidth : this._imageWidth;
            height = this._sourceHeight ? this._sourceHeight : this._imageHeight;
        } else {
            let rowCount = this._domImage.naturalWidth / this.cellWidth;
            let column = (this.cellId / rowCount) >> 0;
            let row = this.cellId % rowCount;

            x = this.cellWidth * row;
            y = this.cellHeight * column;
            width = this.cellWidth;
            height = this.cellHeight;
        }

        this._prepareWorkingCanvasForOpaqueDetection();

        this._applyStates(context);
        if (this._loaded) {
            switch (this._stretch) {
                case Image.STRETCH_NONE:
                    this._drawImage(context, x, y, width, height, this._currentMeasure.left, this._currentMeasure.top, this._currentMeasure.width, this._currentMeasure.height);
                    break;
                case Image.STRETCH_FILL:
                    this._drawImage(context, x, y, width, height, this._currentMeasure.left, this._currentMeasure.top, this._currentMeasure.width, this._currentMeasure.height);
                    break;
                case Image.STRETCH_UNIFORM:
                    var hRatio = this._currentMeasure.width / width;
                    var vRatio = this._currentMeasure.height / height;
                    var ratio = Math.min(hRatio, vRatio);
                    var centerX = (this._currentMeasure.width - width * ratio) / 2;
                    var centerY = (this._currentMeasure.height - height * ratio) / 2;

                    this._drawImage(context, x, y, width, height, this._currentMeasure.left + centerX, this._currentMeasure.top + centerY, width * ratio, height * ratio);
                    break;
                case Image.STRETCH_EXTEND:
                    this._drawImage(context, x, y, width, height, this._currentMeasure.left, this._currentMeasure.top, this._currentMeasure.width, this._currentMeasure.height);
                    break;
                case Image.STRETCH_NINE_PATCH:
                    this._renderNinePatch(context);
                    break;
            }
        }

        context.restore();
    }

    private _renderNinePatch(context: CanvasRenderingContext2D): void {
        let height = this._imageHeight;
        let width = this._imageWidth;
        let leftWidth = this._sliceLeft;
        let rightWidth = this._imageWidth - this._sliceRight;
        let topHeight = this._sliceTop;
        let bottomHeight = this._imageHeight - this._sliceBottom;
        let centerWidth = width - leftWidth - rightWidth;
        let centerHeight = height - topHeight - bottomHeight;
        let widthFactor = width / this._currentMeasure.width;
        let heightFactor = height / this._currentMeasure.height;
        let wfh = widthFactor * 0.5;
        let hfh = heightFactor * 0.5;
        let leftTargetWidth = leftWidth * widthFactor;
        let rightTargetWidth = rightWidth * widthFactor;
        let topTargetHeight = topHeight * heightFactor;
        let bottomTargetHeight = bottomHeight * heightFactor;
        let centerTargetWidth = centerWidth * widthFactor;
        let centerTargetHeight = centerHeight * heightFactor;

        //Top Left
        this._drawImage(context, 0, 0, leftWidth, topHeight, this._currentMeasure.left, this._currentMeasure.top, leftTargetWidth, topTargetHeight);
        //Top
        this._drawImage(context, leftWidth, 0, centerWidth, topHeight, this._currentMeasure.left + leftTargetWidth - wfh, this._currentMeasure.top, centerTargetWidth + widthFactor, topTargetHeight);
        //Top Right
        this._drawImage(context, leftWidth + centerWidth, 0, rightWidth, topHeight, this._currentMeasure.left + leftTargetWidth + centerTargetWidth, this._currentMeasure.top, rightTargetWidth, topTargetHeight);
        //Left
        this._drawImage(context, 0, topHeight, leftWidth, centerHeight, this._currentMeasure.left, this._currentMeasure.top + topTargetHeight - hfh, leftTargetWidth, centerTargetHeight + heightFactor);
        //Center
        this._drawImage(context, leftWidth, topHeight, centerWidth, centerHeight, this._currentMeasure.left + leftTargetWidth - wfh, this._currentMeasure.top + topTargetHeight - hfh, centerTargetWidth + widthFactor, centerTargetHeight + heightFactor);
        //Right
        this._drawImage(context, leftWidth + centerWidth, topHeight, rightWidth, centerHeight, this._currentMeasure.left + leftTargetWidth + centerTargetWidth, this._currentMeasure.top + topTargetHeight - hfh, rightTargetWidth, centerTargetHeight + heightFactor);
        //Bottom Left
        this._drawImage(context, 0, topHeight + centerHeight, leftWidth, bottomHeight, this._currentMeasure.left, this._currentMeasure.top + topTargetHeight + centerTargetHeight, leftTargetWidth, bottomTargetHeight);
        //Bottom
        this._drawImage(context, leftWidth, topHeight + centerHeight, centerWidth, bottomHeight, this._currentMeasure.left + leftTargetWidth - wfh, this._currentMeasure.top + topTargetHeight + centerTargetHeight, centerTargetWidth + widthFactor, bottomTargetHeight);
        //Bottom Right
        this._drawImage(context, leftWidth + centerWidth, topHeight + centerHeight, rightWidth, bottomHeight, this._currentMeasure.left + leftTargetWidth + centerTargetWidth, this._currentMeasure.top + topTargetHeight + centerTargetHeight, rightTargetWidth, bottomTargetHeight);
    }

    public dispose() {
        super.dispose();
        this.onImageLoadedObservable.clear();
        this.onSVGAttributesComputedObservable.clear();
    }

    // Static
    /** STRETCH_NONE */
    public static readonly STRETCH_NONE = 0;
    /** STRETCH_FILL */
    public static readonly STRETCH_FILL = 1;
    /** STRETCH_UNIFORM */
    public static readonly STRETCH_UNIFORM = 2;
    /** STRETCH_EXTEND */
    public static readonly STRETCH_EXTEND = 3;
    /** NINE_PATCH */
    public static readonly STRETCH_NINE_PATCH = 4;
}
_TypeStore.RegisteredTypes["BABYLON.GUI.Image"] = Image;