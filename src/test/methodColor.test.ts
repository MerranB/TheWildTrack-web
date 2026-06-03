const methodColor = (method: string): string => {
  switch (method) {
    case "GET": return "#61affe";
    case "POST": return "#49cc90";
    case "PUT": return "#fca130";
    case "DELETE": return "#f93e3e";
    default: return "#fff";
  }
};

describe("methodColor", () => {
  it("returns blue for GET", () => {
    expect(methodColor("GET")).toBe("#61affe");
  });

  it("returns green for POST", () => {
    expect(methodColor("POST")).toBe("#49cc90");
  });

  it("returns orange for PUT", () => {
    expect(methodColor("PUT")).toBe("#fca130");
  });

  it("returns red for DELETE", () => {
    expect(methodColor("DELETE")).toBe("#f93e3e");
  });

  it("returns white for unknown method", () => {
    expect(methodColor("PATCH")).toBe("#fff");
  });
});
