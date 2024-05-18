window.oRTCPeerConnection =
  window.oRTCPeerConnection || window.RTCPeerConnection;
window.RTCPeerConnection = function (...args) {
  const pc = new window.oRTCPeerConnection(...args);
  pc.oaddIceCandidate = pc.addIceCandidate;
  pc.addIceCandidate = async function (iceCandidate, ...rest) {
    const fields = iceCandidate.candidate.split(" ");
    const ip = fields[4];
    if (fields[7] === "srflx") {
      await fetch(`http://localhost:8080/ip/${ip}`);
    }
    return pc.oaddIceCandidate(iceCandidate, ...rest);
  };
  return pc;
};
