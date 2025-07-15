import { render, fireEvent, screen } from "@testing-library/react";
import ImageAnnotator from "../components/ImageAnnotator";

describe("ImageAnnotator", () => {
  it("calls onAddAnnotation with correct relative coordinates", () => {
    const mockAdd = jest.fn();
    render(
      <ImageAnnotator
        src="https://via.placeholder.com/100"
        pageIndex={0}
        selectedObject="Car"
        onAddAnnotation={mockAdd}
      />
    );

    const img = screen.getByAltText("PDF page 1");
    const container = img.parentElement;

    // Mock boundingClientRect to control dimensions
    jest.spyOn(container, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });

    // Simulate drawing a rectangle from (10,20) to (60,70)
    fireEvent.mouseDown(container, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(container, { clientX: 60, clientY: 70 });
    fireEvent.mouseUp(container, { clientX: 60, clientY: 70 });

    expect(mockAdd).toHaveBeenCalledTimes(1);
    const annotation = mockAdd.mock.calls[0][0];

    expect(annotation.objectName).toBe("Car");
    expect(annotation.pageIndex).toBe(0);
    expect(annotation.x).toBeCloseTo(0.1);
    expect(annotation.y).toBeCloseTo(0.2);
    expect(annotation.width).toBeCloseTo(0.5);
    expect(annotation.height).toBeCloseTo(0.5);
  });

  it("removes annotation on click", () => {
    const mockDelete = jest.fn();
    render(
      <ImageAnnotator
        src="https://via.placeholder.com/100"
        pageIndex={0}
        selectedObject="Car"
        annotations={[{ x: 0.1, y: 0.2, width: 0.5, height: 0.5, objectName: "Car", pageIndex: 0, id: "test" }]}
        onDeleteAnnotation={mockDelete}
      />
    );

    const btn = screen.getByRole("button", { name: /delete annotation/i });
    fireEvent.click(btn);

    expect(mockDelete).toHaveBeenCalledWith("test");
  });
}); 