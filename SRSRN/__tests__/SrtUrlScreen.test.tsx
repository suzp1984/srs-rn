/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {SrtUrlScreen} from '../features/srt/SrtUrlScreen';
import {DEFAULT_SRT_URL} from '../features/srt/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'srt-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'SrtUrl-test', name: 'SrtUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<SrtUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('SrtUrlScreen', () => {
  it('prefills the input with DEFAULT_SRT_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'srt-url-input').props.value).toBe(DEFAULT_SRT_URL);
  });
  it('navigates to SrtPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('SrtPlayer', {srtUrl: DEFAULT_SRT_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for http URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-input').props.onChangeText('http://example.com/stream');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'srt-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'srt-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request');
    });
    expect(input.props.value).toBe('srt://10.0.0.5:10080?streamid=#!::r=live/stream,m=request');
  });
});
