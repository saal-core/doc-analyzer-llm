import * as React from "react"
const SvgComponent = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    fill="none"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      d="M10 18.334a8.333 8.333 0 1 0 0-16.667 8.333 8.333 0 0 0 0 16.667Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      d="M10 11.667a1.667 1.667 0 1 0 0-3.333 1.667 1.667 0 0 0 0 3.333Z"
    />
  </svg>
)
export default SvgComponent
