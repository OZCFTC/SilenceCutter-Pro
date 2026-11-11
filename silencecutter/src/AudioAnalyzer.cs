using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace SilenceCutter
{
    [ComImport, Guid("045FA593-8799-42b8-BC8D-8968C6453507"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMFMediaBuffer
    {
        [PreserveSig] int Lock(out IntPtr ppbBuffer, out int pcbMaxLength, out int pcbCurrentLength);
        [PreserveSig] int Unlock();
        [PreserveSig] int GetCurrentLength(out int pcbCurrentLength);
        [PreserveSig] int SetCurrentLength(int cbCurrentLength);
        [PreserveSig] int GetMaxLength(out int pcbMaxLength);
    }

    [ComImport, Guid("44ae0fa8-ea31-4109-8d2e-4cae4997c555"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMFMediaType
    {
        [PreserveSig] int GetItem([In] ref Guid guidKey, IntPtr pValue);
        [PreserveSig] int GetItemType([In] ref Guid guidKey, out int pType);
        [PreserveSig] int CompareItem([In] ref Guid guidKey, IntPtr Value, out bool pbResult);
        [PreserveSig] int Compare(IntPtr pTheirs, int MatchType, out bool pbResult);
        [PreserveSig] int GetUINT32([In] ref Guid guidKey, out int punValue);
        [PreserveSig] int GetUINT64([In] ref Guid guidKey, out long punValue);
        [PreserveSig] int GetDouble([In] ref Guid guidKey, out double pfValue);
        [PreserveSig] int GetGUID([In] ref Guid guidKey, out Guid pguidValue);
        [PreserveSig] int GetStringLength([In] ref Guid guidKey, out int pcchLength);
        [PreserveSig] int GetString([In] ref Guid guidKey, IntPtr pwszValue, int cchBufSize, IntPtr pcchLength);
        [PreserveSig] int GetAllocatedString([In] ref Guid guidKey, out IntPtr ppwszValue, out int pcchLength);
        [PreserveSig] int GetBlobSize([In] ref Guid guidKey, out int pcbBlobSize);
        [PreserveSig] int GetBlob([In] ref Guid guidKey, IntPtr pBuf, int cbBufSize, IntPtr pcbBlobSize);
        [PreserveSig] int GetAllocatedBlob([In] ref Guid guidKey, out IntPtr ppBuf, out int pcbSize);
        [PreserveSig] int GetUnknown([In] ref Guid guidKey, [In] ref Guid riid, out IntPtr ppv);
        [PreserveSig] int SetItem([In] ref Guid guidKey, IntPtr Value);
        [PreserveSig] int DeleteItem([In] ref Guid guidKey);
        [PreserveSig] int DeleteAllItems();
        [PreserveSig] int SetUINT32([In] ref Guid guidKey, int unValue);
        [PreserveSig] int SetUINT64([In] ref Guid guidKey, long unValue);
        [PreserveSig] int SetDouble([In] ref Guid guidKey, double fValue);
        [PreserveSig] int SetGUID([In] ref Guid guidKey, [In] ref Guid guidValue);
        [PreserveSig] int SetString([In] ref Guid guidKey, [MarshalAs(UnmanagedType.LPWStr)] string wszValue);
        [PreserveSig] int SetBlob([In] ref Guid guidKey, IntPtr pBuf, int cbBufSize);
        [PreserveSig] int SetUnknown([In] ref Guid guidKey, IntPtr pUnknown);
        [PreserveSig] int LockStore();
        [PreserveSig] int UnlockStore();
        [PreserveSig] int GetCount(out int pcItems);
        [PreserveSig] int GetItemByIndex(int unIndex, out Guid pguidKey, IntPtr pValue);
        [PreserveSig] int CopyAllItems(IntPtr pDest);
    }

    [ComImport, Guid("c40a00f2-b93a-4d80-ae8c-5a1c634f58e4"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMFSample
    {
        [PreserveSig] int GetItem([In] ref Guid guidKey, IntPtr pValue);
        [PreserveSig] int GetItemType([In] ref Guid guidKey, out int pType);
        [PreserveSig] int CompareItem([In] ref Guid guidKey, IntPtr Value, out bool pbResult);
        [PreserveSig] int Compare(IntPtr pTheirs, int MatchType, out bool pbResult);
        [PreserveSig] int GetUINT32([In] ref Guid guidKey, out int punValue);
        [PreserveSig] int GetUINT64([In] ref Guid guidKey, out long punValue);
        [PreserveSig] int GetDouble([In] ref Guid guidKey, out double pfValue);
        [PreserveSig] int GetGUID([In] ref Guid guidKey, out Guid pguidValue);
        [PreserveSig] int GetStringLength([In] ref Guid guidKey, out int pcchLength);
        [PreserveSig] int GetString([In] ref Guid guidKey, IntPtr pwszValue, int cchBufSize, IntPtr pcchLength);
        [PreserveSig] int GetAllocatedString([In] ref Guid guidKey, out IntPtr ppwszValue, out int pcchLength);
        [PreserveSig] int GetBlobSize([In] ref Guid guidKey, out int pcbBlobSize);
        [PreserveSig] int GetBlob([In] ref Guid guidKey, IntPtr pBuf, int cbBufSize, IntPtr pcbBlobSize);
        [PreserveSig] int GetAllocatedBlob([In] ref Guid guidKey, out IntPtr ppBuf, out int pcbSize);
        [PreserveSig] int GetUnknown([In] ref Guid guidKey, [In] ref Guid riid, out IntPtr ppv);
        [PreserveSig] int SetItem([In] ref Guid guidKey, IntPtr Value);
        [PreserveSig] int DeleteItem([In] ref Guid guidKey);
        [PreserveSig] int DeleteAllItems();
        [PreserveSig] int SetUINT32([In] ref Guid guidKey, int unValue);
        [PreserveSig] int SetUINT64([In] ref Guid guidKey, long unValue);
        [PreserveSig] int SetDouble([In] ref Guid guidKey, double fValue);
        [PreserveSig] int SetGUID([In] ref Guid guidKey, [In] ref Guid guidValue);
        [PreserveSig] int SetString([In] ref Guid guidKey, [MarshalAs(UnmanagedType.LPWStr)] string wszValue);
        [PreserveSig] int SetBlob([In] ref Guid guidKey, IntPtr pBuf, int cbBufSize);
        [PreserveSig] int SetUnknown([In] ref Guid guidKey, IntPtr pUnknown);
        [PreserveSig] int LockStore();
        [PreserveSig] int UnlockStore();
        [PreserveSig] int GetCount(out int pcItems);
        [PreserveSig] int GetItemByIndex(int unIndex, out Guid pguidKey, IntPtr pValue);
        [PreserveSig] int CopyAllItems(IntPtr pDest);

        // IMFSample methods
        [PreserveSig] int GetSampleFlags(out int pdwSampleFlags);
        [PreserveSig] int SetSampleFlags(int dwSampleFlags);
        [PreserveSig] int GetSampleTime(out long phnsSampleTime);
        [PreserveSig] int SetSampleTime(long hnsSampleTime);
        [PreserveSig] int GetSampleDuration(out long phnsSampleDuration);
        [PreserveSig] int SetSampleDuration(long hnsSampleDuration);
        [PreserveSig] int GetBufferCount(out int pdwBufferCount);
        [PreserveSig] int GetBufferByIndex(int dwIndex, out IMFMediaBuffer ppBuffer);
        [PreserveSig] int ConvertToContiguousBuffer(out IMFMediaBuffer ppBuffer);
    }

    [ComImport, Guid("70ae66f2-c809-4e4f-8915-bdcb406b7993"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMFSourceReader
    {
        [PreserveSig] int GetStreamSelection(uint dwStreamIndex, [Out, MarshalAs(UnmanagedType.Bool)] out bool pfSelected);
        [PreserveSig] int SetStreamSelection(uint dwStreamIndex, [In, MarshalAs(UnmanagedType.Bool)] bool fSelected);
        [PreserveSig] int GetNativeMediaType(uint dwStreamIndex, uint dwMediaTypeIndex, out IMFMediaType ppMediaType);
        [PreserveSig] int GetCurrentMediaType(uint dwStreamIndex, out IMFMediaType ppMediaType);
        [PreserveSig] int SetCurrentMediaType(uint dwStreamIndex, IntPtr pdwReserved, IMFMediaType pMediaType);
        [PreserveSig] int SetCurrentPosition([In] ref Guid guidTimeFormat, IntPtr varPosition);
        [PreserveSig] int ReadSample(uint dwStreamIndex, int dwControlFlags, out uint pdwActualStreamIndex, out int pdwStreamFlags, out long pllTimestamp, out IMFSample ppSample);
        [PreserveSig] int Flush(uint dwStreamIndex);
    }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    internal struct PropVariantLong
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public long hVal;
    }

    internal static class Program
    {
        [DllImport("ole32.dll")]
        private static extern int CoInitializeEx(IntPtr pvReserved, uint dwCoInit);

        [DllImport("mfplat.dll", ExactSpelling = true)]
        private static extern int MFStartup(int version, int dwFlags);

        [DllImport("mfplat.dll", ExactSpelling = true)]
        private static extern int MFShutdown();

        [DllImport("mfplat.dll", ExactSpelling = true)]
        private static extern int MFCreateMediaType(out IMFMediaType ppMFType);

        [DllImport("mfreadwrite.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
        private static extern int MFCreateSourceReaderFromURL(string pwszURL, IntPtr pAttributes, out IMFSourceReader ppSourceReader);

        private const int MF_VERSION = 0x00020070;
        private const uint MF_SOURCE_READER_ALL_STREAMS = 0xFFFFFFFE;
        private const uint MF_SOURCE_READER_FIRST_AUDIO_STREAM = 0xFFFFFFFD;
        private const int MF_SOURCE_READERF_ENDOFSTREAM = 0x00000002;
        private const int MF_SOURCE_READERF_CURRENTMEDIATYPECHANGED = 0x00000010;

        private static Guid MF_MT_MAJOR_TYPE = new Guid("48eba18e-f8c9-4687-bf11-0a74c9f96a8f");
        private static Guid MF_MT_SUBTYPE = new Guid("f7e34c9a-42e8-4714-b74b-cb29d72c35e5");
        private static Guid MF_MT_AUDIO_NUM_CHANNELS = new Guid("37e48bf5-645e-4c5b-89de-ada9e29b696a");
        private static Guid MF_MT_AUDIO_SAMPLES_PER_SECOND = new Guid("5faeeae7-0290-4c31-9e8a-c534f68d9dba");
        private static Guid MF_MT_AUDIO_BITS_PER_SAMPLE = new Guid("f2deb57f-40fa-4764-aa33-ed4f2d1ff669");

        private static Guid MFMediaType_Audio = new Guid("73647561-0000-0010-8000-00AA00389B71");
        private static Guid MFAudioFormat_PCM = new Guid("00000001-0000-0010-8000-00AA00389B71");
        private static Guid MFAudioFormat_Float = new Guid("00000003-0000-0010-8000-00AA00389B71");

        static int Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            string filePath = null;
            double startSec = 0.0;
            double durationSec = 0.0; // 0 = until end
            int windowMs = 10;

            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--file" && i + 1 < args.Length) filePath = args[++i];
                else if (args[i] == "--start" && i + 1 < args.Length) double.TryParse(args[++i], NumberStyles.Any, CultureInfo.InvariantCulture, out startSec);
                else if (args[i] == "--duration" && i + 1 < args.Length) double.TryParse(args[++i], NumberStyles.Any, CultureInfo.InvariantCulture, out durationSec);
                else if (args[i] == "--window-ms" && i + 1 < args.Length) int.TryParse(args[++i], out windowMs);
            }

            if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            {
                Console.WriteLine("{\"success\":false,\"error\":\"Dosya bulunamadı: " + EscapeJson(filePath ?? "") + "\"}");
                return 1;
            }

            if (windowMs < 5) windowMs = 5;
            if (windowMs > 200) windowMs = 200;

            CoInitializeEx(IntPtr.Zero, 0);
            int hr = MFStartup(MF_VERSION, 0);
            if (hr != 0)
            {
                Console.WriteLine("{\"success\":false,\"error\":\"MFStartup hatası: 0x" + hr.ToString("X8") + "\"}");
                return 1;
            }

            IMFSourceReader reader = null;
            try
            {
                hr = MFCreateSourceReaderFromURL(filePath, IntPtr.Zero, out reader);
                if (hr != 0 || reader == null)
                {
                    Console.WriteLine("{\"success\":false,\"error\":\"Medya dosyası açılamadı (0x" + hr.ToString("X8") + ")\"}");
                    return 1;
                }

                reader.SetStreamSelection(MF_SOURCE_READER_ALL_STREAMS, false);
                hr = reader.SetStreamSelection(MF_SOURCE_READER_FIRST_AUDIO_STREAM, true);
                if (hr != 0)
                {
                    Console.WriteLine("{\"success\":false,\"error\":\"Dosyada ses kanalı bulunamadı (0x" + hr.ToString("X8") + ")\"}");
                    return 1;
                }

                bool isFloat = false;
                IMFMediaType partialType;
                MFCreateMediaType(out partialType);
                partialType.SetGUID(ref MF_MT_MAJOR_TYPE, ref MFMediaType_Audio);
                partialType.SetGUID(ref MF_MT_SUBTYPE, ref MFAudioFormat_PCM);
                partialType.SetUINT32(ref MF_MT_AUDIO_BITS_PER_SAMPLE, 16);

                hr = reader.SetCurrentMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM, IntPtr.Zero, partialType);
                Marshal.ReleaseComObject(partialType);

                if (hr != 0)
                {
                    // Fallback: try Float 32-bit
                    IMFMediaType floatType;
                    MFCreateMediaType(out floatType);
                    floatType.SetGUID(ref MF_MT_MAJOR_TYPE, ref MFMediaType_Audio);
                    floatType.SetGUID(ref MF_MT_SUBTYPE, ref MFAudioFormat_Float);
                    hr = reader.SetCurrentMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM, IntPtr.Zero, floatType);
                    Marshal.ReleaseComObject(floatType);
                    if (hr == 0) isFloat = true;
                }

                if (hr != 0)
                {
                    // Fallback: generic PCM without bit depth restriction
                    IMFMediaType genericPcm;
                    MFCreateMediaType(out genericPcm);
                    genericPcm.SetGUID(ref MF_MT_MAJOR_TYPE, ref MFMediaType_Audio);
                    genericPcm.SetGUID(ref MF_MT_SUBTYPE, ref MFAudioFormat_PCM);
                    hr = reader.SetCurrentMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM, IntPtr.Zero, genericPcm);
                    Marshal.ReleaseComObject(genericPcm);
                }

                if (hr != 0)
                {
                    Console.WriteLine("{\"success\":false,\"error\":\"Ses çözücü başlatılamadı (0x" + hr.ToString("X8") + ")\"}");
                    return 1;
                }

                IMFMediaType currentType;
                reader.GetCurrentMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM, out currentType);
                int channels = 2;
                int sampleRate = 48000;
                int bitsPerSample = isFloat ? 32 : 16;
                Guid subType = MFAudioFormat_PCM;
                currentType.GetUINT32(ref MF_MT_AUDIO_NUM_CHANNELS, out channels);
                currentType.GetUINT32(ref MF_MT_AUDIO_SAMPLES_PER_SECOND, out sampleRate);
                currentType.GetUINT32(ref MF_MT_AUDIO_BITS_PER_SAMPLE, out bitsPerSample);
                currentType.GetGUID(ref MF_MT_SUBTYPE, out subType);
                Marshal.ReleaseComObject(currentType);

                isFloat = (subType == MFAudioFormat_Float);
                if (channels <= 0) channels = 1;
                if (sampleRate <= 0) sampleRate = 48000;
                if (bitsPerSample <= 0) bitsPerSample = isFloat ? 32 : 16;

                // Seek slightly before startSec (by 0.5s) so compressed AAC/MP3 keyframe seeking never lands AFTER startSec
                if (startSec > 0.02)
                {
                    double seekTargetSec = Math.Max(0.0, startSec - 0.5);
                    PropVariantLong pv = new PropVariantLong();
                    pv.vt = 20; // VT_I8
                    pv.hVal = (long)(seekTargetSec * 10000000.0); // 100-ns units
                    IntPtr pPv = Marshal.AllocHGlobal(24);
                    try
                    {
                        for (int b = 0; b < 24; b++) Marshal.WriteByte(pPv, b, 0);
                        Marshal.StructureToPtr(pv, pPv, false);
                        Guid timeFormatEmpty = Guid.Empty;
                        reader.SetCurrentPosition(ref timeFormatEmpty, pPv);
                    }
                    finally
                    {
                        Marshal.FreeHGlobal(pPv);
                    }
                }

                double exactFramesPerWindow = (sampleRate * (double)windowMs) / 1000.0;
                long maxFramesToRead = durationSec > 0 ? (long)Math.Round(durationSec * sampleRate) : long.MaxValue;
                long totalFramesRead = 0;
                long targetStartHns = (long)(startSec * 10000000.0);
                bool syncedToStart = (startSec <= 0.02);

                List<float> dbEnvelope = new List<float>(8192);
                double currentWindowSumSq = 0.0;
                int currentWindowFrames = 0;
                double nextWindowBoundaryFrame = exactFramesPerWindow;
                byte[] managedBuf = new byte[65536];

                while (totalFramesRead < maxFramesToRead)
                {
                    uint actualStream;
                    int streamFlags;
                    long timestamp;
                    IMFSample sample;

                    hr = reader.ReadSample(MF_SOURCE_READER_FIRST_AUDIO_STREAM, 0, out actualStream, out streamFlags, out timestamp, out sample);
                    if (hr != 0) break;

                    if ((streamFlags & MF_SOURCE_READERF_CURRENTMEDIATYPECHANGED) != 0)
                    {
                        IMFMediaType newType;
                        if (reader.GetCurrentMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM, out newType) == 0 && newType != null)
                        {
                            newType.GetUINT32(ref MF_MT_AUDIO_NUM_CHANNELS, out channels);
                            newType.GetUINT32(ref MF_MT_AUDIO_SAMPLES_PER_SECOND, out sampleRate);
                            newType.GetUINT32(ref MF_MT_AUDIO_BITS_PER_SAMPLE, out bitsPerSample);
                            newType.GetGUID(ref MF_MT_SUBTYPE, out subType);
                            Marshal.ReleaseComObject(newType);
                            isFloat = (subType == MFAudioFormat_Float);
                            exactFramesPerWindow = (sampleRate * (double)windowMs) / 1000.0;
                            if (durationSec > 0) maxFramesToRead = (long)Math.Round(durationSec * sampleRate);
                        }
                    }

                    if ((streamFlags & MF_SOURCE_READERF_ENDOFSTREAM) != 0)
                    {
                        if (sample != null) Marshal.ReleaseComObject(sample);
                        break;
                    }

                    if (sample == null) continue;

                    IMFMediaBuffer mediaBuffer = null;
                    try
                    {
                        if (sample.ConvertToContiguousBuffer(out mediaBuffer) == 0 && mediaBuffer != null)
                        {
                            IntPtr pData;
                            int maxLen, curLen;
                            if (mediaBuffer.Lock(out pData, out maxLen, out curLen) == 0)
                            {
                                try
                                {
                                    if (curLen > 0)
                                    {
                                        if (managedBuf.Length < curLen) managedBuf = new byte[curLen];
                                        Marshal.Copy(pData, managedBuf, 0, curLen);

                                        int bytesPerSample = Math.Max(1, bitsPerSample / 8);
                                        int bytesPerFrame = channels * bytesPerSample;
                                        int frameCount = curLen / bytesPerFrame;

                                        int fStart = 0;
                                        if (!syncedToStart)
                                        {
                                            long packetDurationHns = (long)((frameCount * 10000000L) / Math.Max(1, sampleRate));
                                            if (timestamp + packetDurationHns <= targetStartHns)
                                            {
                                                // Entire packet is before startSec; skip packet
                                                fStart = frameCount;
                                            }
                                            else if (timestamp < targetStartHns)
                                            {
                                                long diffHns = targetStartHns - timestamp;
                                                int skipFrames = (int)((diffHns * sampleRate) / 10000000L);
                                                fStart = Math.Min(frameCount, Math.Max(0, skipFrames));
                                                syncedToStart = true;
                                            }
                                            else
                                            {
                                                syncedToStart = true;
                                            }
                                        }

                                        for (int f = fStart; f < frameCount && totalFramesRead < maxFramesToRead; f++)
                                        {
                                            int baseIdx = f * bytesPerFrame;
                                            double frameMaxSq = 0.0;

                                            for (int c = 0; c < channels; c++)
                                            {
                                                int idx = baseIdx + c * bytesPerSample;
                                                double norm = 0.0;
                                                if (isFloat && bytesPerSample == 4)
                                                {
                                                    float flt = BitConverter.ToSingle(managedBuf, idx);
                                                    if (!float.IsNaN(flt) && !float.IsInfinity(flt)) norm = flt;
                                                }
                                                else if (bytesPerSample == 2)
                                                {
                                                    short s = (short)(managedBuf[idx] | (managedBuf[idx + 1] << 8));
                                                    norm = s / 32768.0;
                                                }
                                                else if (bytesPerSample == 3)
                                                {
                                                    int s24 = managedBuf[idx] | (managedBuf[idx + 1] << 8) | ((sbyte)managedBuf[idx + 2] << 16);
                                                    norm = s24 / 8388608.0;
                                                }
                                                else if (bytesPerSample == 4)
                                                {
                                                    int s32 = BitConverter.ToInt32(managedBuf, idx);
                                                    norm = s32 / 2147483648.0;
                                                }
                                                else if (bytesPerSample == 1)
                                                {
                                                    norm = (managedBuf[idx] - 128) / 128.0;
                                                }

                                                double sq = norm * norm;
                                                if (sq > frameMaxSq) frameMaxSq = sq;
                                            }

                                            currentWindowSumSq += frameMaxSq;
                                            currentWindowFrames++;
                                            totalFramesRead++;

                                            if (totalFramesRead >= nextWindowBoundaryFrame)
                                            {
                                                double rms = Math.Sqrt(currentWindowSumSq / Math.Max(1, currentWindowFrames));
                                                float db = rms > 1e-5 ? (float)(20.0 * Math.Log10(rms)) : -100.0f;
                                                if (db < -100.0f) db = -100.0f;
                                                if (db > 0.0f) db = 0.0f;
                                                dbEnvelope.Add((float)Math.Round(db, 1));
                                                currentWindowSumSq = 0.0;
                                                currentWindowFrames = 0;
                                                nextWindowBoundaryFrame += exactFramesPerWindow;
                                            }
                                        }
                                    }
                                }
                                finally
                                {
                                    mediaBuffer.Unlock();
                                }
                            }
                        }
                    }
                    finally
                    {
                        if (mediaBuffer != null) Marshal.ReleaseComObject(mediaBuffer);
                        Marshal.ReleaseComObject(sample);
                    }
                }

                if (currentWindowFrames > 0)
                {
                    double rms = Math.Sqrt(currentWindowSumSq / currentWindowFrames);
                    float db = rms > 1e-5 ? (float)(20.0 * Math.Log10(rms)) : -100.0f;
                    if (db < -100.0f) db = -100.0f;
                    if (db > 0.0f) db = 0.0f;
                    dbEnvelope.Add((float)Math.Round(db, 1));
                }

                StringBuilder sb = new StringBuilder(dbEnvelope.Count * 6 + 256);
                sb.Append("{\"success\":true,\"engine\":\"MediaFoundation\",\"sampleRate\":");
                sb.Append(sampleRate);
                sb.Append(",\"channels\":");
                sb.Append(channels);
                sb.Append(",\"windowMs\":");
                sb.Append(windowMs);
                sb.Append(",\"durationSec\":");
                sb.Append((totalFramesRead / (double)sampleRate).ToString("F3", CultureInfo.InvariantCulture));
                sb.Append(",\"envelope\":[");
                for (int i = 0; i < dbEnvelope.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    sb.Append(dbEnvelope[i].ToString("0.0", CultureInfo.InvariantCulture));
                }
                sb.Append("]}");
                Console.WriteLine(sb.ToString());
                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine("{\"success\":false,\"error\":\"" + EscapeJson(ex.Message) + "\"}");
                return 1;
            }
            finally
            {
                if (reader != null) Marshal.ReleaseComObject(reader);
                MFShutdown();
            }
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ");
        }
    }
}
